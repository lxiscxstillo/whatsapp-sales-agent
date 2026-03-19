import { backendFetch } from '@/lib/backend';
import type { Lead } from '@/types/lead';
import { Users, Flame, PhoneForwarded, TrendingUp } from 'lucide-react';
import LeadsListClient from './LeadsListClient';

async function getStats() {
  try {
    const res = await backendFetch('/api/v1/leads?limit=200');
    const data = await res.json();
    const leads: Lead[] = data.data ?? [];
    return {
      total: leads.length,
      hot: leads.filter((l) => l.status === 'HOT').length,
      handoff: leads.filter((l) => l.status === 'HANDOFF').length,
      closed: leads.filter((l) => l.status === 'CLOSED').length,
    };
  } catch {
    return { total: 0, hot: 0, handoff: 0, closed: 0 };
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const stats = await getStats();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-8 lg:pl-0 pl-12">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          {greeting}, Asesor 👋
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Aquí tienes el resumen de tus prospectos activos.
        </p>
      </div>

      {/* Stats grid */}
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
          <p className="text-3xl font-bold text-slate-900 leading-none">{stats.total}</p>
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
          <p className="text-3xl font-bold text-orange-600 leading-none">{stats.hot}</p>
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
          <p className="text-3xl font-bold text-red-600 leading-none">{stats.handoff}</p>
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
          <p className="text-3xl font-bold text-emerald-600 leading-none">{stats.closed}</p>
          <p className="text-xs text-emerald-400 mt-1.5">deals ganados</p>
        </div>
      </div>

      {/* Leads section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">
            {searchParams.status ? `Leads · ${searchParams.status}` : 'Todos los leads'}
          </h3>
          <span className="text-xs text-slate-400">Actualiza cada 4 segundos</span>
        </div>
        <LeadsListClient
          initialStatus={searchParams.status}
          initialPage={searchParams.page ? parseInt(searchParams.page) : 1}
        />
      </div>
    </div>
  );
}
