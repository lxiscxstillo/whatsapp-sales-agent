import type { LeadStatus } from '@/types/lead';
import {
  Sparkles,
  Search,
  Flame,
  PhoneForwarded,
  Clock,
  CheckCircle,
} from 'lucide-react';

type IconComponent = React.ComponentType<{ className?: string }>;

const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; className: string; Icon: IconComponent; pulse?: boolean }
> = {
  NEW: {
    label: 'Nuevo',
    className: 'bg-violet-100 text-violet-700 border border-violet-200/80',
    Icon: Sparkles,
  },
  QUALIFYING: {
    label: 'Calificando',
    className: 'bg-blue-100 text-blue-700 border border-blue-200/80',
    Icon: Search,
  },
  HOT: {
    label: 'Caliente',
    className: 'bg-orange-100 text-orange-700 border border-orange-200/80',
    Icon: Flame,
  },
  HANDOFF: {
    label: 'Handoff',
    className: 'bg-red-100 text-red-700 border border-red-200/80',
    Icon: PhoneForwarded,
    pulse: true,
  },
  PAUSED: {
    label: 'Pausado',
    className: 'bg-amber-100 text-amber-700 border border-amber-200/80',
    Icon: Clock,
  },
  CLOSED: {
    label: 'Cerrado',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200/80',
    Icon: CheckCircle,
  },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.NEW;
  const { label, className, Icon, pulse } = config;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${className} ${
        pulse ? 'animate-pulse' : ''
      }`}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      {label}
    </span>
  );
}
