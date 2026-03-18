import { prisma } from './prisma.client';

type Direction = 'INBOUND' | 'OUTBOUND';
type SenderType = 'LEAD' | 'AGENT' | 'HUMAN';

export interface CreateMessageData {
  leadId: string;
  wppMessageId: string;
  body: string;
  direction: Direction;
  senderType: SenderType;
  isAmbiguous?: boolean;
  langsmithRunId?: string | null;
  rawPayload?: Record<string, unknown>;
}

export async function create(data: CreateMessageData) {
  return prisma.message.create({
    data: {
      leadId: data.leadId,
      wppMessageId: data.wppMessageId,
      body: data.body,
      direction: data.direction,
      senderType: data.senderType,
      isAmbiguous: data.isAmbiguous ?? false,
      langsmithRunId: data.langsmithRunId ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rawPayload: (data.rawPayload as any) ?? undefined,
    },
  });
}

export async function findByLeadId(
  leadId: string,
  params: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 50 } = params;
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.message.count({ where: { leadId } }),
  ]);

  return { messages, total, page, limit };
}

export async function existsByWppId(wppMessageId: string): Promise<boolean> {
  const count = await prisma.message.count({ where: { wppMessageId } });
  return count > 0;
}
