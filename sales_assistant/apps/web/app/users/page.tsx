import { redirect } from 'next/navigation';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { CreateUserForm } from '@/src/components/create-user-form';

export const dynamic = 'force-dynamic';

const ROLE_BADGES: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  AGENT: 'bg-blue-100 text-blue-800',
  USER: 'bg-neutral-200 text-neutral-700',
};

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/');
  const token = session.token;
  const result = await apiRequest('/users', { token, query: { limit: 100 } });
  const users = ((result.json as { data?: unknown[] } | null)?.data ?? []) as { id: string; email: string; name: string | null; role: 'ADMIN' | 'AGENT' | 'USER'; createdAt: string }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Users</h1>
      <Card title="Create user">
        <CreateUserForm />
      </Card>
      <Card>
        <Table
          headers={['Name', 'Email', 'Role', 'Created']}
          rows={users.map((user) => [
            user.name ?? '—',
            user.email,
            <Badge key={user.id} className={ROLE_BADGES[user.role]}>
              {user.role}
            </Badge>,
            new Date(user.createdAt).toLocaleDateString(),
          ])}
        />
      </Card>
    </div>
  );
}