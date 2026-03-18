import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as leadService from '../services/lead.service';
import { AppError } from '../middleware/error.middleware';
import { events } from '../utils/logger';

export const handoffRouter = Router();

const HandoffSchema = z.object({
  reason: z.string().optional(),
});

// ─── POST /api/v1/leads/:id/handoff ──────────────────────────────────────────

handoffRouter.post('/:id/handoff', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = HandoffSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'Validation error', JSON.stringify(parsed.error.issues));
    }

    const lead = await leadService.findById(req.params.id);
    if (!lead) throw new AppError(404, 'Lead not found');

    if (lead.status === 'HANDOFF') {
      throw new AppError(409, 'Lead already in HANDOFF status');
    }

    const reason = parsed.data.reason || 'manual_handoff';
    const updated = await leadService.updateHandoff(req.params.id, reason);

    events.leadHandoff({
      leadId: lead.id,
      phone: lead.phone,
      reason,
      triggeredBy: 'human',
      slots: {},
      interestLevel: lead.interestLevel ?? 0,
    });

    return res.json({ data: { handoff: true, lead: updated } });
  } catch (err) {
    next(err);
  }
});
