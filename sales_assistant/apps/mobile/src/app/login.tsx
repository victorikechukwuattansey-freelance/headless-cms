import '../config';
import { useEffect, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { login as apiLogin } from '@sales_assistant/api-client';
import { getSession, saveSession } from '../session';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<unknown>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setSession(await getSession());
    })();
  }, []);
  if (session) return <Redirect href="/" />;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiLogin(email.trim(), password);
      if (res.status === 200 && res.json?.token) {
        await saveSession({
          token: res.json.token,
          expiresAt: res.json.expiresAt,
          role: res.json.role ?? 'USER',
        });
        router.replace('/');
        return;
      }
      setError(res.json?.error?.message ?? `Sign-in failed (${res.status})`);
    } catch {
      setError('Cannot reach the API. Check EXPO_PUBLIC_API_URL and that the dev stack is running.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Text style={styles.title}>Sales Assistant</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.button, busy && styles.buttonDisabled]} disabled={busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  error: { color: '#dc2626', fontSize: 13 },
  button: { backgroundColor: '#171717', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
});