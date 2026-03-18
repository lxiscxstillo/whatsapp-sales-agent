import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as leadService from '../services/lead.service';

type LeadStatus = 'NEW' | 'QUALIFYING' | 'HOT' | 'HANDOFF' | 'PAUSED' | 'CLOSED';
import * as messageService from '../services/message.service';
import * as wppconnect from '../services/wppconnect.service';
import { AppError } from '../middleware/error.middleware';
import { events } from '../utils/logger';

export const leadsRouter = Router();

// ─── GET /api/v1/leads ────────────────────────────────────────────────────────

leadsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as LeadStatus | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sort = (req.query.sort as string) === 'interestLevel_desc'
      ? 'interestLevel_desc'
      : 'createdAt_desc';

    const result = await leadService.findAll({ status, page, limit, sort });

    return res.json({
      data: result.leads.map(formatLead),
      pagination: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/leads/:id ────────────────────────────────────────────────────

leadsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await leadService.findById(req.params.id);
    if (!lead) throw new AppError(404, 'Lead not found');
    return res.json({ data: formatLead(lead) });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/v1/leads/:id ──────────────────────────────────────────────────

const PatchLeadSchema = z.object({
  status: z.enum(['QUALIFYING', 'HOT', 'HANDOFF', 'PAUSED', 'CLOSED']).optional(),
  agentNotes: z.string().optional(),
  assignedTo: z.string().optional(),
  name: z.string().optional(),
  slotCity: z.string().optional(),
  slotZone: z.string().optional(),
  slotPropertyType: z.string().optional(),
  slotBudget: z.string().optional(),
  slotBudgetNumeric: z.number().optional(),
  slotIntent: z.string().optional(),
  slotBedrooms: z.string().optional(),
  slotUrgency: z.string().optional(),
  slotMainNeed: z.string().optional(),
});

leadsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = PatchLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Validation error', JSON.stringify(parsed.error.issues));
    }

    const lead = await leadService.findById(req.params.id);
    if (!lead) throw new AppError(404, 'Lead not found');

    const updated = await leadService.partialUpdate(req.params.id, parsed.data);

    return res.json({ data: formatLead(updated) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/leads/:id/messages ──────────────────────────────────────────

leadsRouter.get('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await leadService.findById(req.params.id);
    if (!lead) throw new AppError(404, 'Lead not found');

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await messageService.findByLeadId(req.params.id, { page, limit });

    return res.json({
      data: result.messages,
      pagination: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/leads/:id/messages (manual reply) ──────────────────────────

const PostMessageSchema = z.object({
  body: z.string().min(1),
});

leadsRouter.post('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = PostMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Validation error', JSON.stringify(parsed.error.issues));
    }

    const lead = await leadService.findById(req.params.id);
    if (!lead) throw new AppError(404, 'Lead not found');

    // Send via WPPConnect
    await wppconnect.sendMessage(lead.phone, parsed.data.body);

    // Persist as human message
    const wppId = `manual-${Date.now()}-${req.params.id}`;
    const message = await messageService.create({
      leadId: lead.id,
      wppMessageId: wppId,
      body: parsed.data.body,
      direction: 'OUTBOUND',
      senderType: 'HUMAN',
    });

    events.messageSent({
      leadId: lead.id,
      messageId: wppId,
      senderType: 'HUMAN',
      bodyPreview: parsed.data.body.slice(0, 100),
    });

    return res.status(201).json({ data: message });
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLead(lead: Record<string, unknown>) {
  return {
    id: lead.id,
    phone: lead.phone,
    status: lead.status,
    interestLevel: lead.interestLevel,
    isHandoffRequested: lead.isHandoffRequested,
    handoffReason: lead.handoffReason,
    ambiguityCount: lead.ambiguityCount,
    agentNotes: lead.agentNotes,
    assignedTo: lead.assignedTo,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    slots: {
      name: lead.name,
      city: lead.slotCity,
      zone: lead.slotZone,
      propertyType: lead.slotPropertyType,
      budget: lead.slotBudget,
      budgetNumeric: lead.slotBudgetNumeric,
      intent: lead.slotIntent,
      bedrooms: lead.slotBedrooms,
      urgency: lead.slotUrgency,
      mainNeed: lead.slotMainNeed,
    },
  };
}
