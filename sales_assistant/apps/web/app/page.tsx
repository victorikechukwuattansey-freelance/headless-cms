import { redirect } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { LEAD_BADGES, REMINDER_BADGES } from '@/src/lib/status-maps';
import { DismissReminderButton } from '@/src/components/reminder-actions';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'assigned', 'contacted', 'qualified', 'converted', 'lost'] as const;

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;

  const results = await Promise.all([
    ...STATUSES.map((status) => apiRequest('/leads', { token, query: { status, limit: 1 } })),
    apiRequest('/agents', { token, query: { limit: 1 } }),
    apiRequest('/deals', { token, query: { stage: 'proposed', limit: 1 } }),
    apiRequest('/reminders', { token, query: { status: 'pending', limit: 5 } }),
    apiRequest('/leads', { token, query: { limit: 5 } }),
  ]);
  const statusResults = results.slice(0, STATUSES.length);
  const agents = results[STATUSES.length];
  const deals = results[STATUSES.length + 1];
  const reminders = results[STATUSES.length + 2];
  const recent = results[STATUSES.length + 3];

  const totals = Object.fromEntries(STATUSES.map((status, i) => [status, statusResults[i].json?.total ?? 0])) as Record<
    (typeof STATUSES)[number],
    number
  >;
  const agentsTotal = agents.json?.total ?? 0;
  const openDeals = deals.json?.total ?? 0;
  const pendingReminders = reminders.json?.total ?? 0;
  const recentLeads = (recent.json?.data ?? []) as { id: string; phone: string; name: string | null; status: string; score: number }[];
  const reminderItems = (reminders.json?.data ?? []) as { id: string; message: string; dueAt: string; status: string }[];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card title="Total leads">{totals.new + totals.assigned + totals.contacted + totals.qualified + totals.converted + totals.lost}</Card>
        <Card title="Active pipeline">{totals.new + totals.assigned + totals.contacted + totals.qualified}</Card>
        <Card title="Open deals">{openDeals}</Card>
        <Card title="Pending reminders">{pendingReminders}</Card>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        {STATUSES.map((status) => (
          <Card key={status} title={status}>
            <span className="text-xl font-semibold">{totals[status]}</span>
          </Card>
        ))}
        <Card title="Agents">
          <span className="text-xl font-semibold">{agentsTotal}</span>
        </Card>
      </div>
      <Card title="Recent leads">
        <Table
          headers={['Phone', 'Name', 'Status', 'Score', '']}
          rows={recentLeads.map((lead) => [
            lead.phone,
            lead.name ?? '—',
            <Badge key={lead.id} className={LEAD_BADGES[lead.status as keyof typeof LEAD_BADGES] ?? LEAD_BADGES.new}>
              {lead.status}
            </Badge>,
            String(lead.score),
            <Link key={lead.id} href={`/leads/${lead.id}`} className="text-neutral-500 hover:text-neutral-900">
              View →
            </Link>,
          ])}
        />
      </Card>
      <Card title="Pending follow-ups" action={<Link href="/reminders" className="text-sm text-neutral-500 hover:text-neutral-900">All reminders →</Link>}>
        <Table
          headers={['Message', 'Due', 'Status', '']}
          rows={reminderItems.map((reminder) => [
            reminder.message,
            new Date(reminder.dueAt).toLocaleString(),
            <Badge key={reminder.id} className={REMINDER_BADGES[reminder.status as keyof typeof REMINDER_BADGES] ?? REMINDER_BADGES.pending}>
              {reminder.status}
            </Badge>,
            <DismissReminderButton key={reminder.id} reminderId={reminder.id} />,
          ])}
        />
      </Card>
    </div>
  );
}