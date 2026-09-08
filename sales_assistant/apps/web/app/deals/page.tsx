import { redirect } from 'next/navigation';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { DEAL_BADGES } from '@/src/lib/status-maps';
import { DealTransitionButtons } from '@/src/components/deal-actions';

export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const result = await apiRequest('/deals', { token, query: { limit: 100 } });
  const deals = ((result.json as { data?: unknown[] } | null)?.data ?? []) as { id: string; amount: number; stage: 'proposed' | 'won' | 'lost'; createdAt: string }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Deals</h1>
      <Card>
        <Table
          headers={['Amount', 'Stage', 'Created', 'Actions']}
          rows={deals.map((deal) => [
            new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(deal.amount),
            <Badge key={deal.id} className={DEAL_BADGES[deal.stage]}>
              {deal.stage}
            </Badge>,
            new Date(deal.createdAt).toLocaleDateString(),
            <DealTransitionButtons key={deal.id} dealId={deal.id} stage={deal.stage} />,
          ])}
        />
      </Card>
    </div>
  );
}