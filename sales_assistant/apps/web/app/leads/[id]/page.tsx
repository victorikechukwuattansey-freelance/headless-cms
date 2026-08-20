import { redirect, notFound } from 'next/navigation';
import { apiRequest, type Lead } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { LEAD_BADGES } from '@/src/lib/status-maps';
import { LeadActions } from '@/src/components/lead-actions';

export const dynamic = 'force-dynamic';

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const [leadResult, agentsResult] = await Promise.all([
    apiRequest(`/leads/${encodeURIComponent(id)}`, { token }),
    apiRequest('/agents', { token, query: { limit: 100 } }),
  ]);
  if (leadResult.status === 404) notFound();
  const lead = leadResult.json?.data as Lead;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">{lead.name ?? lead.phone}</h1>
      <Card>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">Phone</dt>
            <dd className="font-medium">{lead.phone}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Status</dt>
            <dd>
              <Badge className={LEAD_BADGES[lead.status]}>{lead.status}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Score</dt>
            <dd className="font-medium">{lead.score} / 100</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Agent</dt>
            <dd className="font-medium">{lead.agent?.name ?? 'Unassigned'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Created</dt>
            <dd className="font-medium">{new Date(lead.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Last contacted</dt>
            <dd className="font-medium">{lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString() : '—'}</dd>
          </div>
          {lead.scoreReason && (
            <div className="col-span-2">
              <dt className="text-neutral-500">Score reason</dt>
              <dd className="mt-1 rounded bg-neutral-50 p-2 text-neutral-700">{lead.scoreReason}</dd>
            </div>
          )}
        </dl>
      </Card>
      <Card title="Actions">
        <LeadActions lead={lead} agents={agentsResult.json?.data ?? []} />
        <p className="mt-2 text-xs text-neutral-400">Refresh the page to see changes.</p>
      </Card>
    </div>
  );
}