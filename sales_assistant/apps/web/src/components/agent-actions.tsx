'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AvailabilityToggle({ agentId, status }: { agentId: string; status: 'idle' | 'busy' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/agents/${encodeURIComponent(agentId)}/availability`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ available: status !== 'idle' }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
    >
      {status === 'idle' ? 'Mark busy' : 'Mark available'}
    </button>
  );
}