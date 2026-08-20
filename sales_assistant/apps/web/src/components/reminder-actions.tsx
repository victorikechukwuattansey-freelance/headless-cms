'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/button';

export function DismissReminderButton({ reminderId }: { reminderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function dismiss() {
    setBusy(true);
    await fetch(`/api/reminders/${encodeURIComponent(reminderId)}/dismiss`, { method: 'POST' });
    setBusy(false);
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={dismiss} disabled={busy} className="text-xs">
      Dismiss
    </Button>
  );
}

export function GenerateRemindersButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function generate() {
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/reminders/generate', { method: 'POST' });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMessage(json?.error?.message ?? 'Generation failed');
      return;
    }
    setMessage(`Job queued (${json?.data?.jobId ?? 'unknown'})`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="primary" onClick={generate} disabled={busy}>
        {busy ? 'Queuing…' : 'Generate reminders'}
      </Button>
      {message && <span className="text-xs text-neutral-500">{message}</span>}
    </div>
  );
}