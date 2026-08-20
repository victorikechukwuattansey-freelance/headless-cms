import type { Metadata } from 'next';
import './globals.css';
import { getSession } from '@/src/lib/session';
import { Nav } from '@/src/components/nav';

export const metadata: Metadata = {
  title: 'Sales Assistant',
  description: 'Org operations dashboard',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-100 text-neutral-900 antialiased">
        {session && <Nav role={session.role} />}
        <main className={session ? 'lg:pl-56' : ''}>{children}</main>
      </body>
    </html>
  );
}