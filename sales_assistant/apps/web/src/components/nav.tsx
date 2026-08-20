'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Session } from '@/src/lib/session';

const ITEMS: { href: string; label: string }[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/agents', label: 'Agents' },
  { href: '/bookings', label: 'Bookings' },
  { href: '/reminders', label: 'Reminders' },
  { href: '/deals', label: 'Deals' },
];

export function Nav({ role }: { role: Session['role'] }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col border-r border-neutral-800 bg-neutral-900 p-4 text-neutral-100 lg:flex">
      <div className="mb-6 text-sm font-semibold uppercase tracking-widest text-neutral-400">Sales Assistant</div>
      <ul className="space-y-1">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block rounded px-3 py-2 text-sm hover:bg-neutral-800">
              {item.label}
            </Link>
          </li>
        ))}
        {role === 'ADMIN' && (
          <li>
            <Link href="/users" className="block rounded px-3 py-2 text-sm hover:bg-neutral-800">
              Users
            </Link>
          </li>
        )}
      </ul>
      <div className="mt-auto space-y-2 text-xs text-neutral-400">
        <div className="px-3">Signed in as {role}</div>
        <button onClick={logout} className="w-full rounded bg-neutral-800 px-3 py-2 text-left hover:bg-neutral-700">
          Sign out
        </button>
      </div>
    </nav>
  );
}