import axios, { AxiosError } from 'axios';
import { config } from '../config';
import logger from '../utils/logger';

const agentClient = axios.create({
  baseURL: config.AGENT_URL,
  timeout: 15000,
});

export interface AgentRequest {
  phone: string;
  message: string;
  leadId: string;
  leadStatus: string;
  slots: Record<string, unknown>;
  ambiguityCounter: number;
  interestLevel: number;
}

export interface AgentResponse {
  response: string;
  updatedSlots: Record<string, unknown>;
  interestLevel: number;
  triggerHandoff: boolean;
  handoffReason: string | null;
  isFallback: boolean;
  fallbackAction: string | null;
  ambiguityCounter: number;
  langsmithRunId: string | null;
}

const FALLBACK_RESPONSE =
  'Disculpa, tuve un problema técnico momentáneo. Por favor escríbeme de nuevo en un momento.';

export async function processMessage(req: AgentRequest): Promise<AgentResponse> {
  try {
    const { data } = await agentClient.post('/agent/process', {
      phone: req.phone,
      message: req.message,
      lead_id: req.leadId,
      lead_status: req.leadStatus,
      slots: req.slots,
      ambiguity_counter: req.ambiguityCounter,
      interest_level: req.interestLevel,
    });

    return {
      response: data.response,
      updatedSlots: data.updated_slots ?? {},
      interestLevel: data.interest_level ?? 1,
      triggerHandoff: data.trigger_handoff ?? false,
      handoffReason: data.handoff_reason ?? null,
      isFallback: data.is_fallback ?? false,
      fallbackAction: data.fallback_action ?? null,
      ambiguityCounter: data.ambiguity_counter ?? req.ambiguityCounter,
      langsmithRunId: data.langsmith_run_id ?? null,
    };
  } catch (err) {
    const axiosErr = err as AxiosError;
    logger.error(
      JSON.stringify({
        event: 'agent.error',
        leadId: req.leadId,
        error: axiosErr.message,
        code: axiosErr.code,
      })
    );

    return {
      response: FALLBACK_RESPONSE,
      updatedSlots: req.slots,
      interestLevel: req.interestLevel,
      triggerHandoff: false,
      handoffReason: null,
      isFallback: true,
      fallbackAction: 'AGENT_ERROR',
      ambiguityCounter: req.ambiguityCounter,
      langsmithRunId: null,
    };
  }
}
