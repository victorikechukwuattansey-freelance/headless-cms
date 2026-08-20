'use client';

import { useState } from 'react';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { Button } from '@/src/components/button';
import { BOOKING_BADGES } from '@/src/lib/status-maps';
import { BookingActions } from '@/src/components/booking-actions';
import type { Booking, BookingStatus, Lead, Paginated } from '@sales_assistant/api-client';

const PAGE_SIZE = 20;
const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

export function BookingsTable({ initial, leads }: { initial: Paginated<Booking>; leads: Lead[] }) {
  const [status, setStatus] = useState<BookingStatus | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));

  async function load(nextStatus: BookingStatus | undefined, nextOffset: number) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
    if (nextStatus) params.set('status', nextStatus);
    const res = await fetch(`/api/bookings?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json) {
      setError(json?.error?.message ?? 'Failed to load bookings');
      return;
    }
    setStatus(nextStatus);
    setOffset(nextOffset);
    setData(json);
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => load(undefined, 0)} className={!status ? 'bg-neutral-900 text-white' : ''}>
          All
        </Button>
        {STATUSES.map((s) => (
          <Button key={s} variant="ghost" onClick={() => load(s, 0)} className={status === s ? 'bg-neutral-900 text-white' : ''}>
            {s}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Table
        headers={['When', 'Lead', 'Status', 'Actions']}
        rows={(data?.data ?? []).map((booking) => {
          const lead = leadById.get(booking.leadId);
          return [
            new Date(booking.at).toLocaleString(),
            lead ? `${lead.name ?? '—'} · ${lead.phone}` : booking.leadId.slice(0, 8),
            <Badge key={booking.id} className={BOOKING_BADGES[booking.status]}>
              {booking.status}
            </Badge>,
            <BookingActions key={booking.id} bookingId={booking.id} status={booking.status} />,
          ];
        })}
      />
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          Page {currentPage} of {totalPages} · {data?.total ?? 0} bookings{loading ? ' (loading…)' : ''}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={offset === 0 || loading} onClick={() => load(status, Math.max(0, offset - PAGE_SIZE))}>
            ← Prev
          </Button>
          <Button variant="ghost" disabled={offset + PAGE_SIZE >= (data?.total ?? 0) || loading} onClick={() => load(status, offset + PAGE_SIZE)}>
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}