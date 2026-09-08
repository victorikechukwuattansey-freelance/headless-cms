import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface Session {
  token: string;
  expiresAt: string;
  role: string;
}

const KEY = 'sa_session';

const isWeb = Platform.OS === 'web';

const webStorage = {
  async getItem(key: string): Promise<string | null> {
    return window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    window.localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  },
};

export async function saveSession(session: Session): Promise<void> {
  const raw = JSON.stringify(session);
  if (isWeb) await webStorage.setItem(KEY, raw);
  else await SecureStore.setItemAsync(KEY, raw);
}

export async function getSession(): Promise<Session | null> {
  const raw = isWeb ? await webStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
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
  if (isWeb) await webStorage.removeItem(KEY);
  else await SecureStore.deleteItemAsync(KEY);
}
