import type { DealStage, LeadStatus, ReminderStatus } from '@sales_assistant/api-client';

export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ['assigned'],
  assigned: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['converted', 'lost'],
  converted: [],
  lost: [],
};

export const DEAL_TRANSITIONS: Record<DealStage, DealStage[]> = {
  proposed: ['won', 'lost'],
  won: [],
  lost: [],
};

export const LEAD_BADGES: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  assigned: 'bg-violet-100 text-violet-800',
  contacted: 'bg-amber-100 text-amber-800',
  qualified: 'bg-emerald-100 text-emerald-800',
  converted: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

export const DEAL_BADGES: Record<DealStage, string> = {
  proposed: 'bg-blue-100 text-blue-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

export const REMINDER_BADGES: Record<ReminderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  sent: 'bg-blue-100 text-blue-800',
  dismissed: 'bg-neutral-200 text-neutral-700',
};

export const AGENT_BADGES: Record<'idle' | 'busy', string> = {
  idle: 'bg-emerald-100 text-emerald-800',
  busy: 'bg-neutral-200 text-neutral-700',
};