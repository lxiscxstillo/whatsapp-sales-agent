import { backendFetch } from '@/lib/backend';
import type { Lead } from '@/types/lead';
import Link from 'next/link';

async function getLeadCounts() {
  try {
    const res = await backendFetch('/api/v1/leads?limit=200');
    const data = await res.json();
    const leads: Lead[] = data.data ?? [];
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      counts[lead.status] = (counts[lead.status] ?? 0) + 1;
    }
    return counts;
  } catch {
    return {};
  }
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nuevos',
  QUALIFYING: 'Calificando',
  HOT: 'Calientes',
  HANDOFF: 'Handoff',
  PAUSED: 'Pausados',
  CLOSED: 'Cerrados',
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const counts = await getLeadCounts();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-sm font-bold text-gray-900">WhatsApp Agent</h1>
          <p className="text-xs text-gray-500">Panel de Leads</p>
        </div>
        <nav className="flex-1 p-3">
          <Link
            href="/dashboard"
            className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 mb-1"
          >
            Todos los leads
          </Link>
          <div className="mt-3 space-y-1">
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <Link
                key={status}
                href={`/dashboard?status=${status}`}
                className="flex justify-between items-center px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100"
              >
                <span>{label}</span>
                <span className="text-gray-400 font-medium">{counts[status] ?? 0}</span>
              </Link>
            ))}
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
