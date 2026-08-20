export type Role = 'USER' | 'AGENT' | 'ADMIN';
export interface Paginated<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface ApiErrorBody {
  error: { code: string; message: string };
}
export interface LoginResult {
  token: string;
  expiresAt: string;
  role: Role;
}
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  organizationId: string;
  createdAt: string;
}
export type LeadStatus = 'new' | 'assigned' | 'contacted' | 'qualified' | 'converted' | 'lost';
export interface Agent {
  id: string;
  organizationId: string;
  name: string;
  status: 'idle' | 'busy';
  createdAt: string;
}
export interface Lead {
  id: string;
  organizationId: string;
  phone: string;
  name: string | null;
  score: number;
  scoreReason: string | null;
  lastScoredAt: string | null;
  lastContactedAt: string | null;
  status: LeadStatus;
  agentId: string | null;
  agent: Agent | null;
  createdAt: string;
}
export type DealStage = 'proposed' | 'won' | 'lost';
export interface Deal {
  id: string;
  organizationId: string;
  amount: number;
  stage: DealStage;
  createdAt: string;
}
export type ReminderStatus = 'pending' | 'sent' | 'dismissed';
export interface Reminder {
  id: string;
  organizationId: string;
  leadId: string;
  agentId: string | null;
  dueAt: string;
  message: string;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
  lead: { phone: string; name: string | null };
}
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export interface Booking {
  id: string;
  organizationId: string;
  leadId: string;
  at: string;
  status: BookingStatus;
  createdAt: string;
}
export type AuditEventType =
  | 'AGENT_AVAILABILITY_CHANGED'
  | 'AI_USAGE_LOGGED'
  | 'BOOKING_CREATED'
  | 'BOOKING_STATUS_CHANGED'
  | 'BULK_REMINDERS_GENERATED'
  | 'DEAL_CREATED'
  | 'DEAL_STAGE_CHANGED'
  | 'INTEGRATION_TOKEN_DELETED'
  | 'INTEGRATION_TOKEN_STORED'
  | 'LEAD_ASSIGNED'
  | 'LEAD_CREATED'
  | 'LEAD_SCORED'
  | 'LEAD_STATUS_CHANGED'
  | 'LEAD_UPDATED'
  | 'REMINDER_DISMISSED'
  | 'USER_CREATED'
  | 'USER_UPDATED';

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}
