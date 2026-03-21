import { prisma } from './prisma.client';

type LeadStatus = 'NEW' | 'QUALIFYING' | 'HOT' | 'HANDOFF' | 'PAUSED' | 'CLOSED';

export interface SlotData {
  name?: string | null;
  city?: string | null;
  zone?: string | null;
  propertyType?: string | null;
  budget?: string | null;
  budgetNumeric?: number | null;
  intent?: string | null;
  bedrooms?: string | null;
  urgency?: string | null;
  mainNeed?: string | null;
  objections?: string[];
}

export async function findOrCreate(phone: string) {
  return prisma.lead.upsert({
    where: { phone },
    create: { phone, status: 'NEW' },
    update: {},
  });
}

export async function findById(id: string) {
  return prisma.lead.findUnique({ where: { id } });
}

export async function findAll(params: {
  status?: LeadStatus;
  page?: number;
  limit?: number;
  sort?: 'createdAt_desc' | 'interestLevel_desc';
}) {
  const { status, page = 1, limit = 20, sort = 'createdAt_desc' } = params;
  const skip = (page - 1) * limit;

  const where = status ? { status } : {};

  const orderBy =
    sort === 'interestLevel_desc'
      ? { interestLevel: 'desc' as const }
      : { createdAt: 'desc' as const };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({ where, orderBy, skip, take: limit }),
    prisma.lead.count({ where }),
  ]);

  return { leads, total, page, limit };
}

export async function updateStatus(id: string, status: LeadStatus) {
  return prisma.lead.update({ where: { id }, data: { status } });
}

export async function updateHandoff(id: string, reason: string) {
  return prisma.lead.update({
    where: { id },
    data: {
      status: 'HANDOFF',
      isHandoffRequested: true,
      handoffReason: reason,
    },
  });
}

export async function updateAmbiguityCount(id: string, count: number) {
  return prisma.lead.update({ where: { id }, data: { ambiguityCount: count } });
}

export async function resetAmbiguityCount(leadId: string) {
  return prisma.lead.update({ where: { id: leadId }, data: { ambiguityCount: 0 } });
}

export async function syncSlotsFromAgent(leadId: string, updatedSlots: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  // Only overwrite if the new value is not null/undefined
  if (updatedSlots.name != null) data.name = updatedSlots.name as string;
  if (updatedSlots.city != null) data.slotCity = updatedSlots.city as string;
  if (updatedSlots.zone != null) data.slotZone = updatedSlots.zone as string;
  if (updatedSlots.property_type != null) data.slotPropertyType = updatedSlots.property_type as string;
  if (updatedSlots.budget != null) data.slotBudget = updatedSlots.budget as string;
  if (updatedSlots.budget_numeric != null) data.slotBudgetNumeric = BigInt(updatedSlots.budget_numeric as number);
  if (updatedSlots.intent != null) data.slotIntent = updatedSlots.intent as string;
  if (updatedSlots.bedrooms != null) data.slotBedrooms = updatedSlots.bedrooms as string;
  if (updatedSlots.urgency != null) data.slotUrgency = updatedSlots.urgency as string;
  if (updatedSlots.main_need != null) data.slotMainNeed = updatedSlots.main_need as string;
  // Sales Closer Engine v2: persist neighborhood preference and normalized urgency level
  if (updatedSlots.preferred_neighborhood != null) data.slotNeighborhood = updatedSlots.preferred_neighborhood as string;
  if (updatedSlots.urgency_level != null) data.urgencyLevel = updatedSlots.urgency_level as string;

  if (Object.keys(data).length === 0) return null;

  return prisma.lead.update({ where: { id: leadId }, data });
}

export async function updateInterestLevel(id: string, interestLevel: number) {
  return prisma.lead.update({ where: { id }, data: { interestLevel } });
}

export async function updateAgentNotes(id: string, notes: string) {
  return prisma.lead.update({ where: { id }, data: { agentNotes: notes } });
}

export async function partialUpdate(id: string, data: Record<string, unknown>) {
  return prisma.lead.update({ where: { id }, data });
}
