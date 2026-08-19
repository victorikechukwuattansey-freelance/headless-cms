import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, assignLead, listLeads, login, dismissReminder } from '../src/index.js';

let calls: { url: string; init: RequestInit }[] = [];

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
});

test('apiRequest sends method, bearer token, json body, and query params', async () => {
  mockFetch(200, { ok: true });
  const result = await apiRequest('/leads', {
    method: 'POST',
    token: 'tok-1',
    body: { phone: '+1' },
    query: { limit: 5, status: 'new', agentId: undefined },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { ok: true });
  assert.equal(calls[0].url, 'http://localhost:3000/leads?limit=5&status=new');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, 'Bearer tok-1');
  assert.equal((calls[0].init.headers as Record<string, string>)['content-type'], 'application/json');
  assert.equal(calls[0].init.body, JSON.stringify({ phone: '+1' }));
});

test('apiRequest GET without token or body sends no auth header and parses empty body as null', async () => {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const result = await apiRequest('/health');
  assert.equal(result.status, 204);
  assert.equal(result.json, null);
  assert.ok(!('authorization' in (calls[0].init.headers ?? {})));
});

test('helpers build the documented paths and payloads', async () => {
  mockFetch(200, {});
  await login('a@b.c', 'pw');
  assert.equal(calls[0].url, 'http://localhost:3000/auth/token');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, JSON.stringify({ email: 'a@b.c', password: 'pw' }));

  await listLeads('tok', { status: 'converted', limit: 10 });
  assert.equal(calls[1].url, 'http://localhost:3000/leads?status=converted&limit=10');
  assert.equal((calls[1].init.headers as Record<string, string>).authorization, 'Bearer tok');

  await assignLead('tok', 'lead-1', 'agent-9');
  assert.equal(calls[2].url, 'http://localhost:3000/leads/lead-1/assign');
  assert.equal(calls[2].init.method, 'POST');
  assert.equal(calls[2].init.body, JSON.stringify({ agentId: 'agent-9' }));

  await dismissReminder('tok', 'rem-1');
  assert.equal(calls[3].url, 'http://localhost:3000/reminders/rem-1/dismiss');
  assert.equal(calls[3].init.method, 'POST');
});