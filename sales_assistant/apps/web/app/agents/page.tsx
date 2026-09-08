import { redirect } from 'next/navigation';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { AGENT_BADGES } from '@/src/lib/status-maps';
import { AvailabilityToggle } from '@/src/components/agent-actions';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const result = await apiRequest('/agents', { token, query: { limit: 100 } });
  const agents = ((result.json as { data?: unknown[] } | null)?.data ?? []) as { id: string; name: string; status: 'idle' | 'busy'; createdAt: string }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Agents</h1>
      <Card>
        <Table
          headers={['Name', 'Status', 'Created', 'Availability']}
          rows={agents.map((agent) => [
            agent.name,
            <Badge key={agent.id} className={AGENT_BADGES[agent.status]}>
              {agent.status}
            </Badge>,
            new Date(agent.createdAt).toLocaleDateString(),
            <AvailabilityToggle key={agent.id} agentId={agent.id} status={agent.status} />,
          ])}
        />
      </Card>
    </div>
  );
}