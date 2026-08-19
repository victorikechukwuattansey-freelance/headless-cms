import type { DealStage, LeadStatus, ReminderStatus, Role } from './types.js';

export type {
  Role,
  Paginated,
  ApiErrorBody,
  LoginResult,
  User,
  LeadStatus,
  Agent,
  Lead,
  DealStage,
  Deal,
  ReminderStatus,
  Reminder,
} from './types.js';

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  token?: string;
}

export interface ApiResponse {
  status: number;
  json: any;
}

export function apiUrl(): string {
  return process.env.API_URL ?? 'http://localhost:3000';
}

export async function apiRequest(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) search.set(key, String(value));
  }
  const queryString = search.size > 0 ? `?${search.toString()}` : '';
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${apiUrl()}${path}${queryString}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: response.status, json };
}

export const login = (email: string, password: string) =>
  apiRequest('/auth/token', { method: 'POST', body: { email, password } });

export const listUsers = (token: string, query: { limit?: number; offset?: number } = {}) =>
  apiRequest('/users', { token, query });

export const createUser = (
  token: string,
  input: { email: string; password: string; name?: string; role?: Role },
) => apiRequest('/users', { method: 'POST', token, body: input });

export const listLeads = (
  token: string,
  query: { limit?: number; offset?: number; status?: LeadStatus; agentId?: string } = {},
) => apiRequest('/leads', { token, query });

export const getLead = (token: string, id: string) =>
  apiRequest(`/leads/${encodeURIComponent(id)}`, { token });

export const transitionLeadStatus = (token: string, id: string, status: LeadStatus) =>
  apiRequest(`/leads/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: { status } });

export const assignLead = (token: string, id: string, agentId?: string) =>
  apiRequest(`/leads/${encodeURIComponent(id)}/assign`, {
    method: 'POST',
    token,
    body: agentId ? { agentId } : {},
  });

export const scoreLead = (token: string, id: string) =>
  apiRequest(`/leads/${encodeURIComponent(id)}/score`, { method: 'POST', token });

export const listAgents = (token: string, query: { limit?: number; offset?: number; available?: boolean } = {}) =>
  apiRequest('/agents', { token, query });

export const setAgentAvailability = (token: string, id: string, available: boolean) =>
  apiRequest(`/agents/${encodeURIComponent(id)}/availability`, { method: 'POST', token, body: { available } });

export const listDeals = (token: string, query: { limit?: number; offset?: number; stage?: DealStage } = {}) =>
  apiRequest('/deals', { token, query });

export const transitionDeal = (token: string, id: string, stage: DealStage) =>
  apiRequest(`/deals/${encodeURIComponent(id)}/transition`, { method: 'POST', token, body: { stage } });

export const listReminders = (
  token: string,
  query: { limit?: number; offset?: number; status?: ReminderStatus } = {},
) => apiRequest('/reminders', { token, query });

export const generateReminders = (token: string) =>
  apiRequest('/reminders/generate', { method: 'POST', token });

export const dismissReminder = (token: string, id: string) =>
  apiRequest(`/reminders/${encodeURIComponent(id)}/dismiss`, { method: 'POST', token });