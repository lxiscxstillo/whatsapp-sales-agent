'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import type { Lead, PaginatedResponse } from '@/types/lead';
import { LeadCard } from '@/components/LeadCard';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 22, stiffness: 280 },
  },
};

interface Props {
  initialStatus?: string;
  initialPage?: number;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 border-l-4 border-l-slate-200 p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 animate-shimmer rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 animate-shimmer rounded-lg w-32" />
          <div className="h-3 animate-shimmer rounded-lg w-24" />
        </div>
        <div className="w-20 h-6 animate-shimmer rounded-full flex-shrink-0" />
      </div>
      <div className="flex gap-2 mb-4">
        <div className="h-6 w-20 animate-shimmer rounded-lg" />
        <div className="h-6 w-16 animate-shimmer rounded-lg" />
      </div>
      <div className="flex justify-between items-center">
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 animate-shimmer rounded-sm" />
          ))}
        </div>
        <div className="h-3 w-14 animate-shimmer rounded" />
      </div>
    </div>
  );
}

export default function LeadsListClient({ initialStatus, initialPage = 1 }: Props) {
  const router = useRouter();

  const params = new URLSearchParams();
  if (initialStatus) params.set('status', initialStatus);
  params.set('page', String(initialPage));

  const { data, isLoading } = useSWR<PaginatedResponse<Lead>>(
    `/api/leads?${params.toString()}`,
    fetcher,
    { refreshInterval: 4000 }
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  const leads = data?.data ?? [];

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
          <span className="text-3xl">🏠</span>
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">Sin leads aquí</p>
        <p className="text-xs text-slate-400 max-w-xs">
          {initialStatus
            ? `No hay leads con estado ${initialStatus} en este momento.`
            : 'Cuando lleguen mensajes de WhatsApp, los leads aparecerán aquí.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {leads.map((lead) => (
          <motion.div key={lead.id} variants={cardVariants}>
            <LeadCard
              lead={lead}
              onClick={() => router.push(`/dashboard/${lead.id}`)}
            />
          </motion.div>
        ))}
      </motion.div>

      {data?.pagination && data.pagination.total > 0 && (
        <p className="mt-5 text-xs text-slate-400 text-center">
          Mostrando {leads.length} de {data.pagination.total} leads
        </p>
      )}
    </>
  );
}
