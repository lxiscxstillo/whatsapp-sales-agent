import { backendFetch } from '@/lib/backend';
import type { Lead } from '@/types/lead';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  MapPin,
  Home,
  DollarSign,
  BedDouble,
  Zap,
  Target,
  AlertTriangle,
  FileText,
} from 'lucide-react';
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

const SLOT_CONFIG = [
  { key: 'propertyType', label: 'Tipo de inmueble', Icon: Home },
  { key: 'intent', label: 'Intención', Icon: Target },
  { key: 'city', label: 'Ciudad', Icon: MapPin },
  { key: 'zone', label: 'Zona', Icon: MapPin },
  { key: 'budget', label: 'Presupuesto', Icon: DollarSign },
  { key: 'bedrooms', label: 'Habitaciones', Icon: BedDouble },
  { key: 'urgency', label: 'Urgencia', Icon: Zap },
  { key: 'mainNeed', label: 'Prioridad', Icon: Target },
] as const;

export default async function LeadDetailPage({ params }: { params: { leadId: string } }) {
  const lead = await getLead(params.leadId);
  if (!lead) notFound();

  const interestLevel = lead.interestLevel ?? 0;
  const filledSlots = SLOT_CONFIG.filter(
    (s) => lead.slots[s.key as keyof typeof lead.slots]
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm z-10">
        <Link
          href="/dashboard"
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-slate-500 flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 truncate leading-tight">
            {lead.slots.name || lead.phone}
          </h2>
          <p className="text-xs text-slate-400 font-mono">{lead.phone}</p>
        </div>

        <StatusBadge status={lead.status} />
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Conversation column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ConversationClient leadId={params.leadId} />
          <ReplyForm leadId={params.leadId} isHandoff={lead.status === 'HANDOFF'} />
        </div>

        {/* Right info panel — desktop only */}
        <aside className="hidden lg:flex w-72 flex-col flex-shrink-0 bg-white border-l border-slate-200 overflow-y-auto scrollbar-thin">
          {/* Interest bar */}
          <div className="p-5 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Nivel de interés
            </p>
            <div className="flex gap-1 mb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    i < interestLevel ? 'bg-amber-400' : 'bg-slate-100'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-slate-400">
              {interestLevel}/5 — {interestLevel >= 4 ? 'Muy interesado' : interestLevel >= 2 ? 'Interés moderado' : 'Interés bajo'}
            </p>
          </div>

          {/* Slots */}
          {filledSlots.length > 0 && (
            <div className="p-5 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Perfil del lead
              </p>
              <div className="space-y-3.5">
                {filledSlots.map(({ key, label, Icon }) => {
                  const value = lead.slots[key as keyof typeof lead.slots];
                  return (
                    <div key={key} className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-400 leading-none">{label}</p>
                        <p className="text-sm font-medium text-slate-800 mt-1 leading-snug">
                          {value as string}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Handoff reason */}
          {lead.handoffReason && (
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <p className="text-xs font-semibold text-red-500">Razón de handoff</p>
              </div>
              <p className="text-xs text-slate-700 bg-red-50 border border-red-100 rounded-xl p-3 leading-relaxed">
                {lead.handoffReason}
              </p>
            </div>
          )}

          {/* Agent notes */}
          {lead.agentNotes && (
            <div className="p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Notas
                </p>
              </div>
              <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
                {lead.agentNotes}
              </p>
            </div>
          )}

          {/* Empty info state */}
          {filledSlots.length === 0 && !lead.handoffReason && !lead.agentNotes && (
            <div className="p-5 flex flex-col items-center justify-center text-center py-12">
              <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center mb-3">
                <span className="text-lg">📋</span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Sin datos aún</p>
              <p className="text-xs text-slate-300 mt-1">
                El agente irá llenando el perfil del lead durante la conversación.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
