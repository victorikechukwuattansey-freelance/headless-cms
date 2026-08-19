import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { recordHttpRequest, renderPrometheusMetrics } from './observability/metrics.js';
import { structuredLogger } from './observability/logger.js';
import { authenticate } from './middleware/authenticate.js';
import { requireRole } from './middleware/authorize.js';
import { RateLimiter } from './middleware/rate-limit.js';
import { DomainError } from './domain/domain-error.js';
import type { DomainContext } from './domain/domain-context.js';
import { getOpenApiSpec } from './openapi.js';
import { enqueueJob } from './workers/job-queue.js';
import {
  assignLeadSchema,
  bookingStatusSchema,
  createBookingSchema,
  createDealSchema,
  createLeadSchema,
  createUserSchema,
  dealStageSchema,
  leadStatusSchema,
  listAgentsQuerySchema,
  listBookingsQuerySchema,
  listDealsQuerySchema,
  listLeadsQuerySchema,
  listRemindersQuerySchema,
  listUsersQuerySchema,
  loginSchema,
  parseOrThrow,
  parseQuery,
  setAgentAvailabilitySchema,
  updateLeadSchema,
  updateUserSchema,
} from './validation/schemas.js';
import { AgentService } from './services/agent.service.js';
import { LeadProfileService } from './services/lead-profile.service.js';
import { BookingService } from './services/booking.service.js';
import { DealService } from './services/deal.service.js';
import { UserService } from './services/user.service.js';
import { AuthService } from './services/auth.service.js';
import { LeadScoreService } from './services/lead-score.service.js';
import { FollowUpReminderService } from './services/follow-up-reminder.service.js';

const DOCS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Sales Assistant API</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <div id="redoc"></div>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  <script>Redoc.init('/openapi.json', {}, document.getElementById('redoc'));</script>
</body>
</html>`;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
  });
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.method === 'GET' || req.method === 'DELETE') return {};
  const text = await readBody(req);
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new DomainError('VALIDATION', 'Request body must be a JSON object');
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

function plain<T>(value: T): T {
  const toPlain = (item: unknown): unknown => {
    if (typeof item !== 'object' || item === null) return item;
    if (item instanceof Date) return item.toISOString();
    if (typeof (item as { toNumber?: () => number }).toNumber === 'function') {
      return (item as { toNumber: () => number }).toNumber();
    }
    if (Array.isArray(item)) return item.map(toPlain);
    const out: Record<string, unknown> = {};
    for (const [key, element] of Object.entries(item)) {
      out[key] = toPlain(element);
    }
    return out;
  };
  return toPlain(value) as T;
}

function handleError(res: ServerResponse, err: unknown): void {
  if (err instanceof DomainError) {
    sendJson(res, err.status, { error: { code: err.code, message: err.message } });
    return;
  }
  structuredLogger.error('request.error', { error: err instanceof Error ? err.message : String(err) });
  sendJson(res, 500, { error: { code: 'INTERNAL', message: 'Internal error' } });
}

async function assertRateLimit(
  req: IncomingMessage,
  res: ServerResponse,
  limiter: RateLimiter,
  userId?: string,
): Promise<void> {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = ((Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? '').split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
  const key = userId ? `user:${userId}` : `ip:${ip}`;
  const result = await limiter.check(key);
  if (!result.allowed) {
    res.setHeader('retry-after', String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))));
    res.setHeader('x-ratelimit-limit', String(limiter.max));
    res.setHeader('x-ratelimit-remaining', String(result.remaining));
    res.setHeader('x-ratelimit-reset', String(Math.ceil((Date.now() + result.retryAfterMs) / 1000)));
    throw new DomainError('RATE_LIMITED', 'Too many requests, retry later');
  }
}

function createdLeadPayload(lead: Awaited<ReturnType<LeadProfileService['create']>>) {
  return plain(lead);
}

function createdDealPayload(deal: Awaited<ReturnType<DealService['create']>>) {
  return plain(deal);
}

function updatedDealPayload(deal: Awaited<ReturnType<DealService['transitionStage']>>) {
  return plain(deal);
}

function paginated(body: { data: unknown[]; total: number }, limit: number, offset: number) {
  return { ...plain(body), limit, offset };
}

interface RouteHandlers {
  leads: LeadProfileService;
  agents: AgentService;
  bookings: BookingService;
  deals: DealService;
  users: UserService;
  reminders: FollowUpReminderService;
}

function createRouteHandlers(): RouteHandlers {
  return {
    leads: new LeadProfileService(),
    agents: new AgentService(),
    bookings: new BookingService(),
    deals: new DealService(),
    users: new UserService(),
    reminders: new FollowUpReminderService(),
  };
}

export interface AppOptions {
  rateLimiter?: RateLimiter;
}

export type AppServer = Server & { rateLimiter: RateLimiter };

export function createApp(options: AppOptions = {}) {
  const services = createRouteHandlers();
  const authService = new AuthService();
  const rateLimiter = options.rateLimiter ?? new RateLimiter();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const started = Date.now();
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';
    const segments = url.pathname.split('/').filter(Boolean);

    if (url.pathname === '/metrics' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(renderPrometheusMetrics());
      recordHttpRequest(url.pathname, res.statusCode, Date.now() - started);
      return;
    }
    if (url.pathname === '/health' && req.method === 'GET') {
      sendJson(res, 200, { ok: true });
      recordHttpRequest(url.pathname, res.statusCode, Date.now() - started);
      return;
    }
    if (url.pathname === '/docs' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(DOCS_HTML);
      recordHttpRequest(url.pathname, res.statusCode, Date.now() - started);
      return;
    }
    if (url.pathname === '/openapi.json' && req.method === 'GET') {
      try {
        sendJson(res, 200, await getOpenApiSpec());
      } catch (err) {
        handleError(res, err);
      }
      recordHttpRequest(url.pathname, res.statusCode, Date.now() - started);
      return;
    }

    try {
      const query = url.searchParams;

      if (url.pathname === '/auth/token' && req.method === 'POST') {
        await assertRateLimit(req, res, rateLimiter);
        const body = await readJsonBody(req);
        await routeAuthToken(res, authService, services.users, body);
      } else {
        const context = authenticate(req);
        await assertRateLimit(req, res, rateLimiter, context.userId);
        const body = await readJsonBody(req);

        if (segments[0] === 'leads') {
          await routeLeads(res, services.leads, context, method, segments, body, query);
        } else if (segments[0] === 'agents') {
          await routeAgents(res, services.agents, context, method, segments, body, query);
        } else if (segments[0] === 'bookings') {
          await routeBookings(res, services.bookings, context, method, segments, body, query);
        } else if (segments[0] === 'deals') {
          await routeDeals(res, services.deals, context, method, segments, body, query);
        } else if (segments[0] === 'users') {
          await routeUsers(res, services.users, context, method, segments, body, query);
        } else if (segments[0] === 'reminders') {
          await routeReminders(res, services.reminders, context, method, segments, body, query);
        } else {
          sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
        }
      }
    } catch (err) {
      handleError(res, err);
    }

    recordHttpRequest(url.pathname, res.statusCode, Date.now() - started);
  });

  const app = server as AppServer;
  app.rateLimiter = rateLimiter;
  return app;
}

async function routeAuthToken(
  res: ServerResponse,
  authService: AuthService,
  users: UserService,
  body: Record<string, unknown>,
): Promise<void> {
  const input = parseOrThrow(loginSchema, body);
  const user = await users.findByEmail(input.email.trim().toLowerCase());
  if (!user?.passwordHash) {
    throw new DomainError('UNAUTHORIZED', 'Invalid email or password');
  }
  const valid = await authService.verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new DomainError('UNAUTHORIZED', 'Invalid email or password');
  }
  const { token, expiresAt } = authService.issueTokenWithExpiry({
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
  });
  sendJson(res, 200, { token, expiresAt, role: user.role });
}

async function routeUsers(
  res: ServerResponse,
  service: UserService,
  context: DomainContext,
  method: string,
  segments: string[],
  body: Record<string, unknown>,
  query: URLSearchParams,
): Promise<void> {
  requireRole(context, ['ADMIN']);
  const [, id] = segments;
  if (segments.length === 1 && method === 'GET') {
    const options = parseQuery(listUsersQuerySchema, query);
    sendJson(res, 200, paginated(await service.list(context, options), options.limit, options.offset));
  } else if (segments.length === 1 && method === 'POST') {
    const input = parseOrThrow(createUserSchema, body);
    sendJson(res, 201, { data: plain(await service.create(context, input)) });
  } else if (segments.length === 2 && id && method === 'PATCH') {
    const input = parseOrThrow(updateUserSchema, body);
    sendJson(res, 200, { data: plain(await service.update(context, id, input)) });
  } else {
    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
}

async function routeLeads(
  res: ServerResponse,
  service: LeadProfileService,
  context: DomainContext,
  method: string,
  segments: string[],
  body: Record<string, unknown>,
  query: URLSearchParams,
): Promise<void> {
  const [, id, action] = segments;
  if (segments.length === 1 && method === 'GET') {
    const options = parseQuery(listLeadsQuerySchema, query);
    sendJson(res, 200, paginated(await service.list(context, options), options.limit, options.offset));
  } else if (segments.length === 1 && method === 'POST') {
    const input = parseOrThrow(createLeadSchema, body);
    sendJson(res, 201, {
      data: createdLeadPayload(await service.create(context, input)),
    });
  } else if (segments.length === 2 && id && method === 'GET') {
    sendJson(res, 200, { data: plain(await service.get(context, id)) });
  } else if (segments.length === 2 && id && method === 'PATCH') {
    let data: Awaited<ReturnType<LeadProfileService['transitionStatus']>>;
    if (body.status !== undefined) {
      const { status } = parseOrThrow(leadStatusSchema, { status: body.status });
      data = await service.transitionStatus(context, id, status);
    } else {
      const input = parseOrThrow(updateLeadSchema, body);
      data = await service.update(context, id, input);
    }
    sendJson(res, 200, { data: plain(data) });
  } else if (segments.length === 3 && id && action === 'assign' && method === 'POST') {
    const input = parseOrThrow(assignLeadSchema, body);
    sendJson(res, 200, {
      data: plain(await service.assign(context, id, input.agentId)),
    });
  } else if (segments.length === 3 && id && action === 'score' && method === 'POST') {
    sendJson(res, 200, {
      data: plain(await new LeadScoreService().scoreLead(context, id)),
    });
  } else {
    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
}

async function routeAgents(
  res: ServerResponse,
  service: AgentService,
  context: DomainContext,
  method: string,
  segments: string[],
  body: Record<string, unknown>,
  query: URLSearchParams,
): Promise<void> {
  const [, id, action] = segments;
  if (segments.length === 1 && method === 'GET') {
    const options = parseQuery(listAgentsQuerySchema, query);
    sendJson(res, 200, paginated(await service.list(context, options), options.limit, options.offset));
  } else if (segments.length === 3 && id && action === 'availability' && method === 'POST') {
    const input = parseOrThrow(setAgentAvailabilitySchema, body);
    sendJson(res, 200, {
      data: plain(await service.setAvailability(context, id, input.available)),
    });
  } else {
    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
}

async function routeBookings(
  res: ServerResponse,
  service: BookingService,
  context: DomainContext,
  method: string,
  segments: string[],
  body: Record<string, unknown>,
  query: URLSearchParams,
): Promise<void> {
  const [, id, action] = segments;
  if (segments.length === 1 && method === 'GET') {
    const options = parseQuery(listBookingsQuerySchema, query);
    sendJson(res, 200, paginated(await service.list(context, options), options.limit, options.offset));
  } else if (segments.length === 1 && method === 'POST') {
    const input = parseOrThrow(createBookingSchema, body);
    sendJson(res, 201, {
      data: plain(await service.create(context, input)),
    });
  } else if (segments.length === 3 && id && action === 'transition' && method === 'POST') {
    const { status } = parseOrThrow(bookingStatusSchema, { status: body.status });
    sendJson(res, 200, {
      data: plain(await service.transitionStatus(context, id, status)),
    });
  } else {
    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
}

async function routeDeals(
  res: ServerResponse,
  service: DealService,
  context: DomainContext,
  method: string,
  segments: string[],
  body: Record<string, unknown>,
  query: URLSearchParams,
): Promise<void> {
  const [, id, action] = segments;
  if (segments.length === 1 && method === 'GET') {
    const options = parseQuery(listDealsQuerySchema, query);
    sendJson(res, 200, paginated(await service.list(context, options), options.limit, options.offset));
  } else if (segments.length === 1 && method === 'POST') {
    const input = parseOrThrow(createDealSchema, body);
    sendJson(res, 201, {
      data: createdDealPayload(await service.create(context, input)),
    });
  } else if (segments.length === 3 && id && action === 'transition' && method === 'POST') {
    const { stage } = parseOrThrow(dealStageSchema, { stage: body.stage });
    sendJson(res, 200, {
      data: updatedDealPayload(await service.transitionStage(context, id, stage)),
    });
  } else {
    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
}

async function routeReminders(
  res: ServerResponse,
  service: FollowUpReminderService,
  context: DomainContext,
  method: string,
  segments: string[],
  body: Record<string, unknown>,
  query: URLSearchParams,
): Promise<void> {
  if (segments.length === 1 && method === 'GET') {
    const options = parseQuery(listRemindersQuerySchema, query);
    sendJson(res, 200, paginated(await service.list(context, options), options.limit, options.offset));
  } else if (segments.length === 2 && segments[1] === 'generate' && method === 'POST') {
    requireRole(context, ['ADMIN']);
    const jobId = `reminders-${randomUUID()}`;
    await enqueueJob({
      id: jobId,
      type: 'generate-follow-up-reminders',
      payload: { organizationId: context.organizationId, userId: context.userId, role: context.role },
    });
    sendJson(res, 202, { data: { queued: true, jobId } });
  } else {
    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
}