'use client';

import { useState } from 'react';
import { Modal } from '@/src/components/modal';
import { Button } from '@/src/components/button';
import { LEAD_TRANSITIONS } from '@/src/lib/status-maps';
import type { Agent, Lead } from '@sales_assistant/api-client';

export function LeadActions({
  lead,
  agents,
  refresh = () => undefined,
}: {
  lead: Lead;
  agents: Agent[];
  refresh?: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [agentId, setAgentId] = useState(lead.agentId ?? '');
  const [error, setError] = useState('');

  async function run(method: string, path: string, body?: unknown) {
    setError('');
    const res = await fetch(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? 'Action failed');
      return false;
    }
    refresh();
    return true;
  }

  async function assign() {
    const ok = await run('POST', `/api/leads/${encodeURIComponent(lead.id)}/assign`, { agentId: agentId || undefined });
    if (ok) setAssignOpen(false);
  }

  async function score() {
    await run('POST', `/api/leads/${encodeURIComponent(lead.id)}/score`);
  }

  const targets = LEAD_TRANSITIONS[lead.status];
  const assignable = lead.status === 'new' || lead.status === 'assigned';

  return (
    <div className="flex items-center gap-2">
      {assignable && (
        <Button variant="ghost" className="text-xs" onClick={() => setAssignOpen(true)}>
          Assign
        </Button>
      )}
      {targets.length > 0 && (
        <select
          defaultValue=""
          className="rounded border border-neutral-300 px-2 py-1 text-xs"
          onChange={(e) => {
            if (e.target.value) run('PATCH', `/api/leads/${encodeURIComponent(lead.id)}`, { status: e.target.value });
          }}
        >
          <option value="" disabled>
            Move to…
          </option>
          {targets.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      )}
      <Button variant="ghost" className="text-xs" onClick={score}>
        Score
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
      <Modal open={assignOpen} title="Assign lead" onClose={() => setAssignOpen(false)}>
        <div className="space-y-4">
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Auto (least loaded)</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.status})
              </option>
            ))}
          </select>
          <Button onClick={assign}>Assign</Button>
        </div>
      </Modal>
    </div>
  );
}