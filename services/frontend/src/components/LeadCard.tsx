'use client';

import type { Lead } from '@/types/lead';
import { StatusBadge } from './StatusBadge';
import { MapPin, Home, DollarSign, Star } from 'lucide-react';

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return `hace ${Math.floor(hours / 24)}d`;
}

const STATUS_BORDER: Record<string, string> = {
  NEW: 'border-l-violet-400',
  QUALIFYING: 'border-l-blue-400',
  HOT: 'border-l-orange-400',
  HANDOFF: 'border-l-red-400',
  PAUSED: 'border-l-amber-400',
  CLOSED: 'border-l-emerald-400',
};

const STATUS_AVATAR: Record<string, string> = {
  NEW: 'bg-violet-100 text-violet-700',
  QUALIFYING: 'bg-blue-100 text-blue-700',
  HOT: 'bg-orange-100 text-orange-700',
  HANDOFF: 'bg-red-100 text-red-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-emerald-100 text-emerald-700',
};

interface Props {
  lead: Lead;
  onClick: () => void;
}

export function LeadCard({ lead, onClick }: Props) {
  const displayName = lead.slots.name || lead.phone;
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((s: string) => s[0])
    .join('')
    .toUpperCase();

  const borderColor = STATUS_BORDER[lead.status] ?? 'border-l-slate-300';
  const avatarColor = STATUS_AVATAR[lead.status] ?? 'bg-slate-100 text-slate-600';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl border border-slate-200/80 border-l-4 ${borderColor} p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer`}
    >
      {/* Top row: avatar + name + status */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor}`}
        >
          {initials || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
            {displayName}
          </p>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">{lead.phone}</p>
        </div>
        <div className="flex-shrink-0">
          <StatusBadge status={lead.status} />
        </div>
      </div>

      {/* Slot chips */}
      {(lead.slots.city || lead.slots.propertyType || lead.slots.budget) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {lead.slots.city && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {lead.slots.city}
            </span>
          )}
          {lead.slots.propertyType && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
              <Home className="w-3 h-3 flex-shrink-0" />
              {lead.slots.propertyType}
            </span>
          )}
          {lead.slots.budget && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
              <DollarSign className="w-3 h-3 flex-shrink-0" />
              {lead.slots.budget}
            </span>
          )}
        </div>
      )}

      {/* Bottom row: interest stars + time */}
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-3.5 h-3.5 ${
                i < (lead.interestLevel ?? 0)
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-200 fill-slate-200'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-slate-400">{formatTimeAgo(lead.updatedAt)}</span>
      </div>
    </button>
  );
}
