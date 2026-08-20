import * as SecureStore from 'expo-secure-store';

export interface Session {
  token: string;
  expiresAt: string;
  role: string;
}

const KEY = 'sa_session';

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function getSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (!session.token || !session.expiresAt || !session.role) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
