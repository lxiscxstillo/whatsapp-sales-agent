import { backendFetch } from '@/lib/backend';
import type { Lead } from '@/types/lead';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';
import ConversationClient from './ConversationClient';
import ReplyForm from './ReplyForm';

async function getLead(id: string): Promise<Lead | null> {
  try {
    const res = await backendFetch(`/api/v1/leads/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data;
  } catch {
    return null;
  }
}

function SlotItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs text-gray-400">{label}</span>
      <p className="text-sm text-gray-800 font-medium mt-0.5">{value}</p>
    </div>
  );
}

export default async function LeadDetailPage({ params }: { params: { leadId: string } }) {
  const lead = await getLead(params.leadId);
  if (!lead) notFound();

  return (
    <div className="flex h-full">
      {/* Left: Slots panel */}
      <div className="w-72 bg-white border-r border-gray-200 p-5 flex-shrink-0 overflow-y-auto">
        <div className="mb-4">
          <h3 className="font-semibold text-gray-900 text-base">
            {lead.slots.name || lead.phone}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{lead.phone}</p>
          <div className="mt-2">
            <StatusBadge status={lead.status} />
          </div>
        </div>

        <div className="space-y-3 divide-y divide-gray-100">
          <div className="space-y-3">
            <SlotItem label="Tipo de inmueble" value={lead.slots.propertyType} />
            <SlotItem label="Intención" value={lead.slots.intent} />
            <SlotItem label="Ciudad" value={lead.slots.city} />
            <SlotItem label="Zona" value={lead.slots.zone} />
            <SlotItem label="Presupuesto" value={lead.slots.budget} />
            <SlotItem label="Habitaciones" value={lead.slots.bedrooms} />
            <SlotItem label="Urgencia" value={lead.slots.urgency} />
            <SlotItem label="Prioridad" value={lead.slots.mainNeed} />
          </div>
          {(lead.agentNotes || lead.handoffReason) && (
            <div className="pt-3 space-y-2">
              {lead.handoffReason && (
                <div>
                  <span className="text-xs text-red-400">Razón de handoff</span>
                  <p className="text-xs text-gray-700 mt-0.5">{lead.handoffReason}</p>
                </div>
              )}
              {lead.agentNotes && (
                <div>
                  <span className="text-xs text-gray-400">Notas</span>
                  <p className="text-xs text-gray-700 mt-0.5">{lead.agentNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Conversation */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Conversación</span>
          <span className="text-xs text-gray-400">
            Interés: {'★'.repeat(lead.interestLevel ?? 0)}{'☆'.repeat(5 - (lead.interestLevel ?? 0))}
          </span>
        </div>
        <ConversationClient leadId={params.leadId} />
        <div className="border-t border-gray-200">
          <ReplyForm leadId={params.leadId} />
        </div>
      </div>
    </div>
  );
}
