import { getSession } from '@/src/lib/session';
import { apiRequest } from '@sales_assistant/api-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  const leads = await apiRequest('/leads?limit=5', { token: session?.token });
  const count = leads.status === 200 ? leads.json?.total : 0;
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-neutral-600">
        Placeholder page — replaced by Task 5. {leads.status === 200 ? `${count} leads in org` : 'API unavailable'}.
      </p>
    </div>
  );
}