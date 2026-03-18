import type { LeadStatus } from '@/types/lead';

const STATUS_CONFIG: Record<LeadStatus, { label: string; className: string }> = {
  NEW: {
    label: 'Nuevo',
    className: 'bg-gray-100 text-gray-700 border border-gray-300',
  },
  QUALIFYING: {
    label: 'Calificando',
    className: 'bg-blue-100 text-blue-700 border border-blue-300',
  },
  HOT: {
    label: 'Caliente',
    className: 'bg-orange-100 text-orange-700 border border-orange-300',
  },
  HANDOFF: {
    label: 'Handoff',
    className: 'bg-red-100 text-red-700 border border-red-300 animate-pulse',
  },
  PAUSED: {
    label: 'Pausado',
    className: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
  },
  CLOSED: {
    label: 'Cerrado',
    className: 'bg-green-100 text-green-700 border border-green-300',
  },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { label, className } = STATUS_CONFIG[status] ?? STATUS_CONFIG.NEW;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
