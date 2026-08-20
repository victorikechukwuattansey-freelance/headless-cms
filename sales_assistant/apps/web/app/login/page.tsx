import { redirect } from 'next/navigation';
import { getSession } from '@/src/lib/session';
import { LoginForm } from '@/src/components/login-form';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/');
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Sales Assistant</h1>
        <p className="mb-6 text-sm text-neutral-500">Sign in to the operations dashboard</p>
        <LoginForm />
      </div>
    </div>
  );
}