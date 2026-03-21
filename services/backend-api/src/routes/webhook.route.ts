import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as leadService from '../services/lead.service';
import * as messageService from '../services/message.service';
import * as agentService from '../services/agent.service';
import * as wppconnect from '../services/wppconnect.service';
import logger, { events } from '../utils/logger';
import { setQrCode, clearQrCode } from '../utils/qr-store';

export const webhookRouter = Router();

// ─── Webhook payload schema ───────────────────────────────────────────────────

const WebhookPayloadSchema = z.object({
  id: z.string(),
  from: z.string(),
  body: z.string().optional().default(''),
  type: z.string(),
  timestamp: z.number(),
  fromMe: z.boolean(),
  isGroupMsg: z.boolean(),
  session: z.string().optional(),
  event: z.string().optional(),
});

// ─── POST /api/v1/webhook/message ─────────────────────────────────────────────
//
// Connection guarantee: WPPConnect's onmessage event only fires when session
// state is isLogged (CONNECTED). If this endpoint is reached, WPPConnect IS
// connected by definition — no additional connection status check is needed.

webhookRouter.post('/message', async (req: Request, res: Response, next: NextFunction) => {
  const event: string | undefined = req.body?.event;

  // Log every non-message event at debug level so we can see what WPPConnect sends
  if (event && event !== 'onmessage') {
    logger.info({ event: 'wpp_webhook_received', wppEvent: event, keys: Object.keys(req.body) });
  }

  // ── QR code event ────────────────────────────────────────────────────────────
  // WPPConnect v2.8.x fires event="qrcode" with fields: qrcode, urlcode, session.
  // `status-session` stays at INITIALIZING during this window, so we capture
  // the QR here and serve it from qr-store in GET /api/v1/auth/qr.
  if (event === 'qrcode') {
    // Payload: { event: 'qrcode', session: '...', qrcode: '<base64_img>', urlcode: '<url>' }
    // Prefer the base64 image (qrcode) — fallback to urlcode for display.
    const qr: string | null =
      (typeof req.body?.qrcode === 'string' && req.body.qrcode ? req.body.qrcode : null)
      ?? (typeof req.body?.urlcode === 'string' && req.body.urlcode ? req.body.urlcode : null);
    if (qr) setQrCode(qr);
    return res.status(200).json({ captured: 'qrcode' });
  }

  // ── Session connected — clear stale QR ──────────────────────────────────────
  // WPPConnect fires event="status-find" with status field when session changes.
  if (event === 'status-find' || event === 'onStateChange' || event === 'statusFind') {
    const status: string | undefined = req.body?.status ?? req.body?.data;
    if (status === 'isLogged' || status === 'CONNECTED') clearQrCode();
    return res.status(200).json({ captured: event, status });
  }

  // Filter other non-message events (onack, onpresencechanged, etc.)
  if (event && event !== 'onmessage') {
    return res.status(200).json({ ignored: event });
  }

  // Parse and validate payload
  const parsed = WebhookPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid webhook payload', details: parsed.error.issues });
  }

  const payload = parsed.data;

  // Filter self-messages, groups, non-text messages, and @lid (linked device) contacts
  if (payload.fromMe) return res.status(200).json({ ignored: 'fromMe' });
  if (payload.isGroupMsg) return res.status(200).json({ ignored: 'isGroup' });
  if (payload.type !== 'chat') return res.status(200).json({ ignored: 'non-chat type' });

  // Accept @c.us, @s.whatsapp.net, and @lid (WhatsApp privacy mode) formats
  const fromLower = payload.from.toLowerCase();
  const isLid = fromLower.endsWith('@lid');
  if (!fromLower.endsWith('@c.us') && !fromLower.endsWith('@s.whatsapp.net') && !isLid) {
    return res.status(200).json({ ignored: 'non-standard-id', from: payload.from });
  }

  // For @lid users store the full LID as the identifier (e.g. "78718378717325@lid")
  // For normal users strip the domain suffix to get the phone number
  const phone = isLid
    ? payload.from
    : payload.from.replace(/@c\.us$|@s\.whatsapp\.net$/i, '');

  try {
    // 1. Idempotency check
    const alreadyProcessed = await messageService.existsByWppId(payload.id);
    if (alreadyProcessed) {
      return res.status(200).json({ ignored: 'duplicate' });
    }

    // 2. Find or create lead
    const lead = await leadService.findOrCreate(phone);

    // Build slots map from lead's flat columns
    const currentSlots: Record<string, unknown> = {
      name: lead.name,
      city: lead.slotCity,
      zone: lead.slotZone,
      property_type: lead.slotPropertyType,
      budget: lead.slotBudget,
      budget_numeric: lead.slotBudgetNumeric,
      intent: lead.slotIntent,
      bedrooms: lead.slotBedrooms,
      urgency: lead.slotUrgency,
      main_need: lead.slotMainNeed,
    };

    // 3. Emit message.received event
    events.messageReceived({
      leadId: lead.id,
      messageId: payload.id,
      phone,
      bodyPreview: payload.body.slice(0, 100),
    });

    // 4. Persist inbound message
    await messageService.create({
      leadId: lead.id,
      wppMessageId: payload.id,
      body: payload.body,
      direction: 'INBOUND',
      senderType: 'LEAD',
      rawPayload: payload as Record<string, unknown>,
    });

    // 5. If lead is HANDOFF, PAUSED or CLOSED, do not invoke agent
    if (['HANDOFF', 'PAUSED', 'CLOSED'].includes(lead.status)) {
      return res.status(200).json({ status: 'agent_stopped', reason: lead.status.toLowerCase() });
    }

    // 6. Invoke agent — wrapped in its own try/catch for graceful degradation.
    // If the agent is unavailable or times out, we send a friendly fallback
    // message to the lead instead of returning 500 to WPPConnect (which would
    // cause retries and duplicate processing).
    let agentResult: Awaited<ReturnType<typeof agentService.processMessage>>;
    try {
      agentResult = await agentService.processMessage({
        phone,
        message: payload.body,
        leadId: lead.id,
        leadStatus: lead.status.toLowerCase(),
        slots: currentSlots,
        ambiguityCounter: lead.ambiguityCount,
        interestLevel: lead.interestLevel ?? 1,
      });
    } catch (agentErr) {
      const agentErrMsg = agentErr instanceof Error ? agentErr.message : String(agentErr);
      events.agentError({
        leadId: lead.id,
        messageId: payload.id,
        errorType: 'agent_unavailable',
        errorMessage: agentErrMsg,
        fallbackTriggered: true,
      });
      const fallbackText =
        'Hola, en este momento estoy procesando muchas consultas. Te respondo en unos segundos, ¡gracias por tu paciencia! 😊';
      try {
        await wppconnect.sendMessage(phone, fallbackText);
      } catch {
        // WPPConnect also unavailable — nothing more we can do. Log is already emitted.
      }
      return res.status(200).json({ status: 'agent_fallback', error: agentErrMsg });
    }

    // 7. Persist outbound message
    const outboundWppId = `agent-${payload.id}`;
    await messageService.create({
      leadId: lead.id,
      wppMessageId: outboundWppId,
      body: agentResult.response,
      direction: 'OUTBOUND',
      senderType: 'AGENT',
      isAmbiguous: agentResult.isFallback,
      langsmithRunId: agentResult.langsmithRunId,
    });

    // 8. Sync slots and lead state
    if (agentResult.updatedSlots) {
      await leadService.syncSlotsFromAgent(lead.id, agentResult.updatedSlots);
    }

    await leadService.updateInterestLevel(lead.id, agentResult.interestLevel ?? 1);

    // 9. Handle ambiguity counter
    if (agentResult.isFallback && agentResult.fallbackAction !== 'AGENT_ERROR') {
      await leadService.updateAmbiguityCount(lead.id, agentResult.ambiguityCounter);
      events.ambiguousMessage({
        leadId: lead.id,
        messageId: payload.id,
        ambiguityCount: agentResult.ambiguityCounter,
        rawMessage: payload.body,
        fallbackAction: agentResult.fallbackAction || 'ASK_CLARIFICATION',
      });
    } else if (!agentResult.isFallback) {
      await leadService.resetAmbiguityCount(lead.id);
    }

    // 10. Handle handoff
    // ISO 25010 — Functional Correctness (handoff flow):
    // LangGraph returns trigger_handoff=true when the agent decides to escalate.
    // The backend uses lead.id (retrieved from DB in step 2) — NOT lead_id from
    // the agent state — to update the DB. Future messages from this phone are
    // silently dropped at step 5 (['HANDOFF', 'PAUSED', 'CLOSED'] guard).
    if (agentResult.triggerHandoff) {
      await leadService.updateHandoff(lead.id, agentResult.handoffReason || 'qualified_lead');
      events.leadHandoff({
        leadId: lead.id,
        phone,
        reason: agentResult.handoffReason || 'qualified_lead',
        triggeredBy: 'agent',
        slots: agentResult.updatedSlots,
        interestLevel: agentResult.interestLevel,
      });
    } else if (lead.status === 'NEW') {
      await leadService.updateStatus(lead.id, 'QUALIFYING');
    }

    // 11. Update status to HOT if interest high but not yet handoff
    if (agentResult.interestLevel >= 3 && !agentResult.triggerHandoff) {
      await leadService.updateStatus(lead.id, 'HOT');
    }

    // 12. Emit slots_updated event
    events.slotsUpdated({
      leadId: lead.id,
      changedSlots: agentResult.updatedSlots as Record<string, { prev: unknown; new: unknown }>,
      slotsOverwritten: false,
    });

    // 13. Send response via WPPConnect
    await wppconnect.sendMessage(phone, agentResult.response);

    events.messageSent({
      leadId: lead.id,
      messageId: outboundWppId,
      senderType: 'AGENT',
      bodyPreview: agentResult.response.slice(0, 100),
    });

    return res.status(200).json({ status: 'ok', langsmithRunId: agentResult.langsmithRunId });
  } catch (err) {
    next(err);
  }
});
