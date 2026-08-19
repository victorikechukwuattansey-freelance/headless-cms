import { DomainError } from './domain-error.js';

export const LEAD_STATUSES = ['new', 'assigned', 'contacted', 'qualified', 'converted', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ['assigned'],
  assigned: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['converted', 'lost'],
  converted: [],
  lost: [],
};

export const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const DEAL_STAGES = ['proposed', 'won', 'lost'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const DEAL_TRANSITIONS: Record<DealStage, readonly DealStage[]> = {
  proposed: ['won', 'lost'],
  won: [],
  lost: [],
};

export function assertTransition<T extends string>(
  map: Record<T, readonly T[]>,
  from: T,
  to: T,
  label: string,
): void {
  const allowed = map[from] ?? [];
  if (!allowed.includes(to)) {
    throw new DomainError('INVALID_TRANSITION', `Invalid ${label} transition: ${from} -> ${to}`);
  }
}