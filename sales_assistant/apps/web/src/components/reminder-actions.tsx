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