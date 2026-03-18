export type LeadStatus = 'NEW' | 'QUALIFYING' | 'HOT' | 'HANDOFF' | 'PAUSED' | 'CLOSED';
export type Direction = 'INBOUND' | 'OUTBOUND';
export type SenderType = 'LEAD' | 'AGENT' | 'HUMAN';

export interface LeadSlots {
  name: string | null;
  city: string | null;
  zone: string | null;
  propertyType: string | null;
  budget: string | null;
  budgetNumeric: number | null;
  intent: string | null;
  bedrooms: string | null;
  urgency: string | null;
  mainNeed: string | null;
}

export interface Lead {
  id: string;
  phone: string;
  status: LeadStatus;
  interestLevel: number;
  isHandoffRequested: boolean;
  handoffReason: string | null;
  ambiguityCount: number;
  agentNotes: string | null;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  slots: LeadSlots;
}

export interface Message {
  id: string;
  leadId: string;
  wppMessageId: string | null;
  direction: Direction;
  senderType: SenderType;
  body: string;
  isAmbiguous: boolean;
  langsmithRunId: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}
