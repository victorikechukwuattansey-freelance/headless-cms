import '../config';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listLeads } from '@sales_assistant/api-client';
import { clearSession, getSession } from '../session';

interface Lead {
  id: string;
  name: string;
  email: string;
  company?: string | null;
  status: string;
  createdAt?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const session = await getSession();
      if (!session) return;
      setError('');
      const res = await listLeads(session.token, { limit: 50 });
      const json = res.json as { data?: Lead[]; error?: { message?: string } } | null;
      if (res.status === 200 && json?.data) {
        setLeads(json.data);
      } else {
        setError(json?.error?.message ?? `Failed to load leads (${res.status})`);
      }
    } catch {
      setError('Cannot reach the API.');
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#171717" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Leads</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            <Text style={styles.email}>{item.email}</Text>
            {item.company ? <Text style={styles.company}>{item.company}</Text> : null}
          </View>
        )}
        contentContainerStyle={styles.list}
      />
      <Pressable
        style={styles.logout}
        onPress={async () => {
          await clearSession();
          router.replace('/login');
        }}
      >
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 24, fontWeight: '600', paddingHorizontal: 16, marginBottom: 12, color: '#171717' },
  list: { paddingHorizontal: 16 },
  row: { borderBottomWidth: 1, borderColor: '#e5e5e5', paddingVertical: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600' },
  status: { fontSize: 12, color: '#171717', backgroundColor: '#f4f4f5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  email: { color: '#71717a', marginTop: 2 },
  company: { color: '#a1a1aa', fontSize: 13, marginTop: 2 },
  error: { color: '#dc2626', paddingHorizontal: 16, marginBottom: 8 },
  logout: { padding: 16, alignItems: 'center' },
  logoutText: { color: '#dc2626', fontWeight: '600' },
});