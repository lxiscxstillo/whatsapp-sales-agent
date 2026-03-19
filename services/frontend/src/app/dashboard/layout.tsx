import { backendFetch } from '@/lib/backend';
import type { Lead } from '@/types/lead';
import Sidebar from '@/components/Sidebar';

async function getLeadCounts(): Promise<Record<string, number>> {
  try {
    const res = await backendFetch('/api/v1/leads?limit=200');
    const data = await res.json();
    const leads: Lead[] = data.data ?? [];
    const counts: Record<string, number> = { _total: leads.length };
    for (const lead of leads) {
      counts[lead.status] = (counts[lead.status] ?? 0) + 1;
    }
    return counts;
  } catch {
    return { _total: 0 };
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const counts = await getLeadCounts();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar counts={counts} />
      <main className="flex-1 overflow-auto min-w-0 scrollbar-thin">
        {children}
      </main>
    </div>
  );
}
