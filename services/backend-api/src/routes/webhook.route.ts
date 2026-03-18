import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as leadService from '../services/lead.service';
import * as messageService from '../services/message.service';
import * as agentService from '../services/agent.service';
import * as wppconnect from '../services/wppconnect.service';
import { events } from '../utils/logger';

export const webhookRouter = Router();

// ─── Webhook payload schema ───────────────────────────────────────────────────

const WebhookPayloadSchema = z.object({
  id: z.string(),
  from: z.string(),
  body: z.string(),
  type: z.string(),
  timestamp: z.number(),
  fromMe: z.boolean(),
  isGroup: z.boolean(),
  session: z.string().optional(),
  event: z.string().optional(),
});

// ─── POST /api/v1/webhook/message ─────────────────────────────────────────────

webhookRouter.post('/message', async (req: Request, res: Response, next: NextFunction) => {
  // Parse and validate payload
  const parsed = WebhookPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid webhook payload', details: parsed.error.issues });
  }

  const payload = parsed.data;

  // Filter self-messages, groups, and non-text messages
  if (payload.fromMe) return res.status(200).json({ ignored: 'fromMe' });
  if (payload.isGroup) return res.status(200).json({ ignored: 'isGroup' });
  if (payload.type !== 'chat') return res.status(200).json({ ignored: 'non-chat type' });

  const phone = payload.from.replace('@c.us', '');

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

    // 5. If lead is already in HANDOFF, do not invoke agent
    if (lead.status === 'HANDOFF') {
      return res.status(200).json({ status: 'handoff_paused' });
    }

    // 6. Invoke agent
    const agentResult = await agentService.processMessage({
      phone,
      message: payload.body,
      leadId: lead.id,
      leadStatus: lead.status.toLowerCase(),
      slots: currentSlots,
      ambiguityCounter: lead.ambiguityCount,
      interestLevel: lead.interestLevel ?? 1,
    });

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
