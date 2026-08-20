export const SESSION_COOKIE = 'sa_session';

export interface Session {
  token: string;
  expiresAt: string;
  role: 'USER' | 'AGENT' | 'ADMIN';
}

export function parseSession(value: string | undefined): Session | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Session>;
    if (
      typeof parsed.token === 'string' &&
      typeof parsed.expiresAt === 'string' &&
      (parsed.role === 'USER' || parsed.role === 'AGENT' || parsed.role === 'ADMIN')
    ) {
      return { token: parsed.token, expiresAt: parsed.expiresAt, role: parsed.role };
    }
    return null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(expiresAt: string) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  };
}