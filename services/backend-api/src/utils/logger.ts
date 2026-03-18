import winston from 'winston';
import { config } from '../config';

const logger = winston.createLogger({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format:
        config.NODE_ENV === 'development'
          ? winston.format.combine(winston.format.colorize(), winston.format.simple())
          : winston.format.json(),
    }),
  ],
});

// ─── Typed event logging ──────────────────────────────────────────────────────

export interface LogEventBase {
  event: string;
  leadId?: string;
  messageId?: string;
  langsmithRunId?: string;
  [key: string]: unknown;
}

export function logEvent(payload: LogEventBase): void {
  logger.info({ ...payload, timestamp: new Date().toISOString() });
}

// Convenience helpers matching the event catalog in spec Section 6
export const events = {
  messageReceived: (data: {
    leadId: string;
    phone: string;
    messageId: string;
    wppMessageId?: string;
    bodyPreview: string;
  }) => logEvent({ event: 'message.received', ...data }),

  intentDetected: (data: {
    leadId: string;
    messageId: string;
    intent: string;
    confidence: number;
    langsmithRunId?: string;
    nodeLatencyMs?: number;
  }) => logEvent({ event: 'agent.intent_detected', ...data }),

  slotsUpdated: (data: {
    leadId: string;
    changedSlots: Record<string, { prev: unknown; new: unknown }>;
    slotsOverwritten: boolean;
  }) => logEvent({ event: 'lead.slots_updated', ...data }),

  slotOverwritten: (data: {
    leadId: string;
    slot: string;
    prevValue: unknown;
    newValue: unknown;
    triggerMessage: string;
  }) => logEvent({ event: 'lead.slot_overwritten', ...data }),

  ambiguousMessage: (data: {
    leadId: string;
    messageId: string;
    ambiguityCount: number;
    rawMessage: string;
    fallbackAction: string;
  }) => logEvent({ event: 'agent.ambiguous_message', ...data }),

  leadEvaluated: (data: {
    leadId: string;
    interestLevel: number;
    slotsCompleted: string[];
    slotsMissing: string[];
    shouldHandoff: boolean;
  }) => logEvent({ event: 'lead.evaluated', ...data }),

  leadHandoff: (data: {
    leadId: string;
    phone: string;
    reason: string;
    triggeredBy: string;
    slots: Record<string, unknown>;
    interestLevel: number;
  }) => logEvent({ event: 'lead.handoff', ...data }),

  messageSent: (data: {
    leadId: string;
    messageId: string;
    senderType: string;
    bodyPreview: string;
    totalLatencyMs?: number;
    tokensUsed?: number;
    sentBy?: string;
  }) => logEvent({ event: 'message.sent', ...data }),

  agentError: (data: {
    leadId: string;
    messageId?: string;
    errorType: string;
    errorMessage: string;
    fallbackTriggered: boolean;
    langsmithRunId?: string;
  }) => logEvent({ event: 'agent.error', ...data }),
};

export default logger;
