import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiRequest } from '@sales_assistant/api-client';
import { SESSION_COOKIE, sessionCookieOptions } from '../../../../src/lib/session-core';

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const email = typeof raw?.email === 'string' ? raw.email : undefined;
  const password = typeof raw?.password === 'string' ? raw.password : undefined;
  if (!email || !password) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'email and password are required' } }, { status: 400 });
  }
  const result = await apiRequest('/auth/token', { method: 'POST', body: { email, password } });
  if (result.status !== 200 || !result.json?.token) {
    return NextResponse.json(
      result.json ?? { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } },
      { status: result.status },
    );
  }
  const expiresAt = result.json.expiresAt as string;
  const role = result.json.role as 'USER' | 'AGENT' | 'ADMIN';
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify({ token: result.json.token, expiresAt, role }), sessionCookieOptions(expiresAt));
  return NextResponse.json({ role });
}