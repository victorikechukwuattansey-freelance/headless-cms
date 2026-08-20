'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/button';
import { BOOKING_TRANSITIONS } from '@/src/lib/status-maps';
import type { BookingStatus } from '@sales_assistant/api-client';

export function BookingActions({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const targets = BOOKING_TRANSITIONS[status];

  async function transition(to: BookingStatus) {
    setError('');
    const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: to }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? 'Transition failed');
      return;
    }
    router.refresh();
  }

  if (targets.length === 0) return <span className="text-xs text-neutral-400">Terminal</span>;
  return (
    <div className="flex items-center gap-2">
      {targets.map((target) => (
        <Button key={target} variant="ghost" className="text-xs" onClick={() => transition(target)}>
          Mark {target}
        </Button>
      ))}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}