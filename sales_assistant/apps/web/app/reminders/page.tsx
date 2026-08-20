import { redirect } from 'next/navigation';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { REMINDER_BADGES } from '@/src/lib/status-maps';
import { DismissReminderButton, GenerateRemindersButton } from '@/src/components/reminder-actions';

export const dynamic = 'force-dynamic';

export default async function RemindersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const result = await apiRequest('/reminders', { token, query: { limit: 100 } });
  const reminders = (result.json?.data ?? []) as {
    id: string;
    message: string;
    dueAt: string;
    status: 'pending' | 'sent' | 'dismissed';
    lead: { phone: string; name: string | null };
  }[];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Reminders</h1>
        {session.role === 'ADMIN' && <GenerateRemindersButton />}
      </div>
      <Card>
        <Table
          headers={['Lead', 'Message', 'Due', 'Status', '']}
          rows={reminders.map((reminder) => [
            reminder.lead.name ?? reminder.lead.phone,
            reminder.message,
            new Date(reminder.dueAt).toLocaleString(),
            <Badge key={reminder.id} className={REMINDER_BADGES[reminder.status]}>
              {reminder.status}
            </Badge>,
            reminder.status === 'pending' ? <DismissReminderButton key={reminder.id} reminderId={reminder.id} /> : null,
          ])}
        />
      </Card>
    </div>
  );
}