'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/button';
import type { Lead } from '@sales_assistant/api-client';

export function CreateBookingForm({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [leadId, setLeadId] = useState('');
  const [at, setAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leadId, at: new Date(at).toISOString() }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(json?.error?.message ?? 'Booking failed');
      return;
    }
    setLeadId('');
    setAt('');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
      <select
        required
        value={leadId}
        onChange={(e) => setLeadId(e.target.value)}
        className="rounded border border-neutral-300 px-3 py-2 text-sm"
      >
        <option value="">Select a lead…</option>
        {leads.map((lead) => (
          <option key={lead.id} value={lead.id}>
            {lead.name ?? lead.phone} — {lead.phone}
          </option>
        ))}
      </select>
      <input
        type="datetime-local"
        required
        value={at}
        onChange={(e) => setAt(e.target.value)}
        className="rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center">
        <Button disabled={busy}>{busy ? 'Creating…' : 'Create booking'}</Button>
      </div>
      {error && <p className="text-sm text-red-600 md:col-span-4">{error}</p>}
    </form>
  );
}