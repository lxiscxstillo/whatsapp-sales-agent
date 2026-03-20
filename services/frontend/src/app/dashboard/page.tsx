import LeadsListClient from './LeadsListClient';
import StatsGrid from './StatsGrid';

export default function DashboardPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
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

      {/* Stats grid — client component, polls every 5s */}
      <StatsGrid />

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
