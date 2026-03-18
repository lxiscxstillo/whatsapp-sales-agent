import LeadsListClient from './LeadsListClient';

export default function DashboardPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Leads</h2>
        <p className="text-sm text-gray-500 mt-1">
          Prospectos activos en WhatsApp
        </p>
      </div>
      <LeadsListClient
        initialStatus={searchParams.status}
        initialPage={searchParams.page ? parseInt(searchParams.page) : 1}
      />
    </div>
  );
}
