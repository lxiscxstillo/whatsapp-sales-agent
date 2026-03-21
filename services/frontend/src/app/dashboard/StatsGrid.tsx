'use client';

import useSWR from 'swr';
import { Users, Flame, PhoneForwarded, TrendingUp } from 'lucide-react';
import type { Lead, PaginatedResponse } from '@/types/lead';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function StatsGrid() {
  const { data } = useSWR<PaginatedResponse<Lead>>(
    '/api/leads?limit=200',
    fetcher,
    { refreshInterval: 2500 }
  );

  const leads = data?.data ?? [];
  const total = leads.length;
  const hot = leads.filter((l) => l.status === 'HOT').length;
  const handoff = leads.filter((l) => l.status === 'HANDOFF').length;
  const closed = leads.filter((l) => l.status === 'CLOSED').length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Total */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total
          </span>
        </div>
        <p className="text-3xl font-bold text-slate-900 leading-none">{total}</p>
        <p className="text-xs text-slate-400 mt-1.5">leads registrados</p>
      </div>

      {/* HOT */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-200/60 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
            Calientes
          </span>
        </div>
        <p className="text-3xl font-bold text-orange-600 leading-none">{hot}</p>
        <p className="text-xs text-orange-400 mt-1.5">listos para cerrar</p>
      </div>

      {/* HANDOFF */}
      <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-4 border border-red-200/60 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
            <PhoneForwarded className="w-4 h-4 text-red-500" />
          </div>
          <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
            Handoff
          </span>
        </div>
        <p className="text-3xl font-bold text-red-600 leading-none">{handoff}</p>
        <p className="text-xs text-red-400 mt-1.5">esperan tu llamada</p>
      </div>

      {/* CLOSED */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4 border border-emerald-200/60 shadow-sm">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Cerrados
          </span>
        </div>
        <p className="text-3xl font-bold text-emerald-600 leading-none">{closed}</p>
        <p className="text-xs text-emerald-400 mt-1.5">deals ganados</p>
      </div>
    </div>
  );
}
