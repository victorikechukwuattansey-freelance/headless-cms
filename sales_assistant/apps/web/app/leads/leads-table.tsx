'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { Button } from '@/src/components/button';
import { LEAD_BADGES } from '@/src/lib/status-maps';
import type { Agent, Lead, LeadStatus, Paginated } from '@sales_assistant/api-client';
import { LeadActions } from '@/src/components/lead-actions';

const PAGE_SIZE = 20;
const STATUSES = ['new', 'assigned', 'contacted', 'qualified', 'converted', 'lost'] as const;

export function LeadsTable({ initial, agents }: { initial: Paginated<Lead>; agents: Agent[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<LeadStatus | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(nextStatus: LeadStatus | undefined, nextOffset: number) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
    if (nextStatus) params.set('status', nextStatus);
    const res = await fetch(`/api/leads?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json) {
      setError(json?.error?.message ?? 'Failed to load leads');
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
        headers={['Phone', 'Name', 'Status', 'Score', 'Agent', 'Actions']}
        rows={(data?.data ?? []).map((lead) => [
          <Link key={lead.id} href={`/leads/${lead.id}`} className="hover:underline">
            {lead.phone}
          </Link>,
          lead.name ?? '—',
          <Badge key={lead.id} className={LEAD_BADGES[lead.status]}>
            {lead.status}
          </Badge>,
          String(lead.score),
          lead.agent?.name ?? '—',
          <LeadActions key={lead.id} lead={lead} agents={agents} refresh={router.refresh} />,
        ])}
      />
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          Page {currentPage} of {totalPages} · {data?.total ?? 0} leads{loading ? ' (loading…)' : ''}
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