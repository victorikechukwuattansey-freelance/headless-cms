import { cookies } from 'next/headers';
import { parseSession, SESSION_COOKIE, type Session } from './session-core';

export type { Session } from './session-core';

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return parseSession(store.get(SESSION_COOKIE)?.value);
}