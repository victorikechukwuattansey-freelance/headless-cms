import Link from 'next/link';
import type { AuditEventType } from '@sales_assistant/api-client';

const shortId = (id: unknown) =>
  typeof id === 'string' && id.length > 8 ? `${id.slice(0, 8)}...` : String(id ?? '-');

const leadLink = (id: unknown) => (
  <Link href={`/leads/${encodeURIComponent(String(id))}`} className="font-mono underline hover:opacity-70">
    {shortId(id)}
  </Link>
);

export const AUDIT_TYPE_GROUPS: Record<AuditEventType, string> = {
  AGENT_AVAILABILITY_CHANGED: 'bg-violet-100 text-violet-800',
  AI_USAGE_LOGGED: 'bg-indigo-100 text-indigo-800',
  BOOKING_CREATED: 'bg-sky-100 text-sky-800',
  BOOKING_STATUS_CHANGED: 'bg-sky-100 text-sky-800',
  BULK_REMINDERS_GENERATED: 'bg-amber-100 text-amber-800',
  DEAL_CREATED: 'bg-emerald-100 text-emerald-800',
  DEAL_STAGE_CHANGED: 'bg-emerald-100 text-emerald-800',
  INTEGRATION_TOKEN_DELETED: 'bg-neutral-200 text-neutral-700',
  INTEGRATION_TOKEN_STORED: 'bg-neutral-200 text-neutral-700',
  LEAD_ASSIGNED: 'bg-blue-100 text-blue-800',
  LEAD_CREATED: 'bg-blue-100 text-blue-800',
  LEAD_SCORED: 'bg-blue-100 text-blue-800',
  LEAD_STATUS_CHANGED: 'bg-blue-100 text-blue-800',
  LEAD_UPDATED: 'bg-blue-100 text-blue-800',
  REMINDER_DISMISSED: 'bg-amber-100 text-amber-800',
  USER_CREATED: 'bg-red-100 text-red-800',
  USER_UPDATED: 'bg-red-100 text-red-800',
};

export function describeAuditEvent(
  type: AuditEventType,
  payload: Record<string, unknown>,
): React.ReactNode {
  switch (type) {
    case 'AGENT_AVAILABILITY_CHANGED':
      return `Agent ${shortId(payload.agentId)} is now ${payload.available ? 'available' : 'busy'}`;
    case 'AI_USAGE_LOGGED':
      return `AI call via ${String(payload.model ?? '-')} (${String(payload.tokensIn ?? 0)} in / ${String(payload.tokensOut ?? 0)} out, USD ${String(payload.cost ?? '0')})`;
    case 'BOOKING_CREATED':
      return <>Booking {shortId(payload.bookingId)} booked for {leadLink(payload.leadId)} at {new Date(String(payload.at)).toLocaleString()}</>;
    case 'BOOKING_STATUS_CHANGED':
      return <>Booking {shortId(payload.bookingId)} moved {String(payload.from)} {'->'} {String(payload.to)}</>;
    case 'BULK_REMINDERS_GENERATED':
      return <>Generated {String(payload.generated ?? 0)} reminders from {String(payload.total ?? 0)} qualifying leads</>;
    case 'DEAL_CREATED':
      return <>Deal {shortId(payload.dealId)} created{payload.leadId ? <> for {leadLink(payload.leadId)}</> : null} at {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(payload.amount ?? 0))}</>;
    case 'DEAL_STAGE_CHANGED':
      return <>Deal {shortId(payload.dealId)} moved {String(payload.from)} {'->'} {String(payload.to)}</>;
    case 'INTEGRATION_TOKEN_DELETED':
      return <>Integration token removed</>;
    case 'INTEGRATION_TOKEN_STORED':
      return <>Integration token stored</>;
    case 'LEAD_ASSIGNED':
      return <>Lead {leadLink(payload.leadId)} assigned to agent {shortId(payload.agentId)}</>;
    case 'LEAD_CREATED':
      return <>Lead {leadLink(payload.leadId)} created{payload.phone ? <> with phone {String(payload.phone)}</> : null}</>;
    case 'LEAD_SCORED':
      return <>Lead {leadLink(payload.leadId)} scored {String(payload.score ?? 0)}/100 via {String(payload.source ?? 'ai')}{payload.reason ? <> - {String(payload.reason)}</> : null}</>;
    case 'LEAD_STATUS_CHANGED':
      return <>Lead {leadLink(payload.leadId)} status changed {String(payload.from)} {'->'} {String(payload.to)}</>;
    case 'LEAD_UPDATED':
      return <>Lead {leadLink(payload.leadId)} details updated</>;
    case 'REMINDER_DISMISSED':
      return <>Reminder {shortId(payload.reminderId)} dismissed for {leadLink(payload.leadId)}</>;
    case 'USER_CREATED':
      return `User ${String(payload.email ?? '-')} created with role ${String(payload.role ?? 'USER')}`;
    case 'USER_UPDATED':
      return `User ${String(payload.email ?? '-')} profile updated`;
    default:
      return <code className="text-xs break-all">{JSON.stringify(payload)}</code>;
  }
}
