import { redirect } from 'next/navigation';
import { listBookings, listLeads, type Booking, type Lead, type Paginated } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { BookingsTable } from './bookings-table';
import { CreateBookingForm } from '@/src/components/create-booking-form';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const [bookings, leads] = await Promise.all([
    listBookings(token, { limit: PAGE_SIZE }),
    listLeads(token, { limit: 100 }),
  ]);
  const leadItems = (leads.json as { data?: Lead[] } | null)?.data ?? [];
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Bookings</h1>
      <Card title="Book a call">
        <CreateBookingForm leads={leadItems} />
      </Card>
      <Card>
        <BookingsTable initial={bookings.json as Paginated<Booking>} leads={leadItems} />
      </Card>
    </div>
  );
}
