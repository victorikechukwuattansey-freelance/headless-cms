import { redirect } from 'next/navigation';
import { listAuditEvents } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { ActivityList } from './activity-list';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/');
  const audit = await listAuditEvents(session.token, { limit: PAGE_SIZE });
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Activity</h1>
      <Card>
        <ActivityList initial={audit.json} />
      </Card>
    </div>
  );
}
