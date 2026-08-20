'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/button';
import { DEAL_TRANSITIONS } from '@/src/lib/status-maps';
import type { DealStage } from '@sales_assistant/api-client';

export function DealTransitionButtons({ dealId, stage }: { dealId: string; stage: DealStage }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const targets = DEAL_TRANSITIONS[stage];

  async function transition(to: DealStage) {
    setError('');
    const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage: to }),
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