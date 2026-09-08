import { NextRequest, NextResponse } from 'next/server';
import { parseSession, SESSION_COOKIE } from '../../../src/lib/session-core';

const FORWARD_HEADERS = ['retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'];

function upstreamUrl(): string {
  const url = process.env.API_URL;
  if (url) return url;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('API_URL must be set in production');
  }
  return 'http://localhost:3000';
}

async function proxy(req: NextRequest, path: string[]) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Method not allowed' } }, { status: 405 });
  }
  const session = parseSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Session required' } }, { status: 401 });
  }
  let target: URL;
  try {
    target = new URL(`${upstreamUrl()}/${path.join('/')}${req.nextUrl.search}`);
  } catch {
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'API_URL misconfigured' } }, { status: 500 });
  }
  const headers: Record<string, string> = { authorization: `Bearer ${session.token}` };
  const hasBody = req.body !== null;
  if (hasBody) headers['content-type'] = 'application/json';
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
      cache: 'no-store',
      ...(hasBody ? { duplex: 'half' as const } : {}),
    });
  } catch (error) {
    console.error('[proxy] upstream fetch failed', req.method, target.href, error);
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'API unreachable' } }, { status: 502 });
  }
  const text = await upstream.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  const response = NextResponse.json(json, { status: upstream.status });
  for (const name of FORWARD_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) response.headers.set(name, value);
  }
  return response;
}

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;