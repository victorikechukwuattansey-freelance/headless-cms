import { redirect } from 'next/navigation';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { LeadsTable } from './leads-table';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const [leads, agents] = await Promise.all([
    apiRequest('/leads', { token, query: { limit: PAGE_SIZE } }),
    apiRequest('/agents', { token, query: { limit: 100 } }),
  ]);
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Leads</h1>
      <LeadsTable initial={leads.json} agents={agents.json?.data ?? []} />
    </div>
  );
}