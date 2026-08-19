import { z } from 'zod';
import { DomainError } from '../domain/domain-error.js';
import { BOOKING_STATUSES, DEAL_STAGES, LEAD_STATUSES } from '../domain/transitions.js';

export function validationError(error: z.ZodError): DomainError {
  const message = error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; ');
  return new DomainError('VALIDATION', message);
}

export function parseOrThrow<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.output<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

export function parseQuery<TSchema extends z.ZodTypeAny>(schema: TSchema, params: URLSearchParams): z.output<TSchema> {
  return parseOrThrow(schema, Object.fromEntries(params.entries()));
}

const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
};

export const createLeadSchema = z.object({
  phone: z.string().trim().min(1, 'phone is required'),
  name: z.string().trim().min(1).optional(),
  score: z.number().int().min(0).max(100).optional(),
});

export const updateLeadSchema = z.object({
  phone: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  score: z.number().int().min(0).max(100).optional(),
});

export const leadStatusSchema = z.object({ status: z.enum(LEAD_STATUSES) });

export const assignLeadSchema = z.object({ agentId: z.string().min(1).optional() });

export const listLeadsQuerySchema = z.object({
  ...pagination,
  status: z.enum(LEAD_STATUSES).optional(),
  agentId: z.string().min(1).optional(),
});

export const listAgentsQuerySchema = z.object({
  ...pagination,
  available: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});

export const setAgentAvailabilitySchema = z.object({ available: z.boolean() });

export const createBookingSchema = z.object({
  leadId: z.string().min(1, 'leadId is required'),
  at: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
});

export const bookingStatusSchema = z.object({ status: z.enum(BOOKING_STATUSES) });

export const listBookingsQuerySchema = z.object({
  ...pagination,
  status: z.enum(BOOKING_STATUSES).optional(),
});

export const createDealSchema = z.object({
  amount: z.number().finite('amount must be a number').min(0),
  stage: z.enum(DEAL_STAGES).optional(),
});

export const dealStageSchema = z.object({ stage: z.enum(DEAL_STAGES) });

export const listDealsQuerySchema = z.object({
  ...pagination,
  stage: z.enum(DEAL_STAGES).optional(),
});

const ROLES = ['USER', 'AGENT', 'ADMIN'] as const;

export const loginSchema = z.object({
  email: z.string().email('email must be a valid email address'),
  password: z.string().min(1, 'password is required'),
});

export const createUserSchema = z.object({
  email: z.string().email('email must be a valid email address'),
  password: z.string().min(8, 'password must be at least 8 characters'),
  name: z.string().trim().min(1).optional(),
  role: z.enum(ROLES).optional(),
});

export const updateUserSchema = z
  .object({
    password: z.string().min(8, 'password must be at least 8 characters').optional(),
    role: z.enum(ROLES).optional(),
  })
  .refine((data) => data.password !== undefined || data.role !== undefined, 'At least one of password or role is required');

export const listUsersQuerySchema = z.object({
  ...pagination,
});

export const REMINDER_STATUSES = ['pending', 'sent', 'dismissed'] as const;

export const listRemindersQuerySchema = z.object({
  ...pagination,
  status: z.enum(REMINDER_STATUSES).optional(),
});