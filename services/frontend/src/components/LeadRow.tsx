import type { Lead } from '@/types/lead';
import { StatusBadge } from './StatusBadge';

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function InterestStars({ level }: { level: number }) {
  return (
    <span className="text-yellow-500 text-sm">
      {'★'.repeat(level)}
      {'☆'.repeat(5 - level)}
    </span>
  );
}

interface LeadRowProps {
  lead: Lead;
  onClick: () => void;
}

export function LeadRow({ lead, onClick }: LeadRowProps) {
  const displayName = lead.slots.name || lead.phone;

  return (
    <tr
      onClick={onClick}
      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{displayName}</td>
      <td className="px-4 py-3">
        <StatusBadge status={lead.status} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {lead.slots.propertyType || '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {lead.slots.city || '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {lead.slots.budget || '—'}
      </td>
      <td className="px-4 py-3">
        <InterestStars level={lead.interestLevel ?? 0} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {formatTimeAgo(lead.updatedAt)}
      </td>
    </tr>
  );
}
