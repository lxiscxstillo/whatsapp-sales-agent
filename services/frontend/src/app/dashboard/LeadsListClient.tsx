'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { Lead, PaginatedResponse } from '@/types/lead';
import { LeadRow } from '@/components/LeadRow';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  initialStatus?: string;
  initialPage?: number;
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
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        Cargando leads...
      </div>
    );
  }

  const leads = data?.data ?? [];

  if (leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No hay leads {initialStatus ? `con estado ${initialStatus}` : 'aún'}.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {['Nombre / Teléfono', 'Estado', 'Tipo', 'Ciudad', 'Presupuesto', 'Interés', 'Último mensaje'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              onClick={() => router.push(`/dashboard/${lead.id}`)}
            />
          ))}
        </tbody>
      </table>
      {data?.pagination && (
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
          {data.pagination.total} leads en total
        </div>
      )}
    </div>
  );
}
