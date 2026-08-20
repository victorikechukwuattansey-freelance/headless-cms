'use client';

import { useState } from 'react';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { Button } from '@/src/components/button';
import { describeAuditEvent, AUDIT_TYPE_GROUPS } from '@/src/lib/audit-formatters';
import { AUDIT_EVENT_TYPES } from '@sales_assistant/api-client';
import type { AuditEvent, AuditEventType, Paginated } from '@sales_assistant/api-client';

const PAGE_SIZE = 20;

export function ActivityList({ initial }: { initial: Paginated<AuditEvent> }) {
  const [type, setType] = useState<AuditEventType | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(nextType: AuditEventType | undefined, nextOffset: number) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
    if (nextType) params.set('type', nextType);
    const res = await fetch(`/api/audit-events?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json) {
      setError(json?.error?.message ?? 'Failed to load events');
      return;
    }
    setType(nextType);
    setOffset(nextOffset);
    setData(json);
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => load(undefined, 0)} className={!type ? 'bg-neutral-900 text-white' : ''}>
          All
        </Button>
        {AUDIT_EVENT_TYPES.map((t) => (
          <Button key={t} variant="ghost" onClick={() => load(t, 0)} className={type === t ? 'bg-neutral-900 text-white' : ''}>
            {t}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Table
        headers={['Event', 'Details', 'When']}
        rows={(data?.data ?? []).map((event) => [
          <Badge key={event.id} className={AUDIT_TYPE_GROUPS[event.eventType]}>
            {event.eventType}
          </Badge>,
          describeAuditEvent(event.eventType, event.payload ?? {}),
          new Date(event.createdAt).toLocaleString(),
        ])}
      />
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          Page {currentPage} of {totalPages} · {data?.total ?? 0} events{loading ? ' (loading…)' : ''}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={offset === 0 || loading} onClick={() => load(type, Math.max(0, offset - PAGE_SIZE))}>
            ← Prev
          </Button>
          <Button variant="ghost" disabled={offset + PAGE_SIZE >= (data?.total ?? 0) || loading} onClick={() => load(type, offset + PAGE_SIZE)}>
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
