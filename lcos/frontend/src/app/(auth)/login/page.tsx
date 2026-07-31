'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shirt } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate login - replace with actual auth
    setTimeout(() => {
      setLoading(false);
      router.push('/dashboard');
    }, 1000);
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2">
            <Shirt className="h-8 w-8 text-luxury-gold" />
            <span className="font-display text-2xl font-bold">LCOS</span>
          </div>
          <h2 className="mt-8 text-2xl font-bold leading-9 tracking-tight">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Luxury Commerce Operating System
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <a href="/register" className="font-semibold text-foreground hover:text-luxury-gold">
                Create one
              </a>
            </p>
          </form>
        </div>
      </div>

      <div className="relative hidden flex-1 lg:block">
        <div className="absolute inset-0 luxury-gradient" />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center text-white">
            <h1 className="font-display text-5xl font-bold">AI-Powered</h1>
            <h2 className="mt-2 font-display text-4xl font-bold text-luxury-gold">
              Luxury Commerce
            </h2>
            <p className="mt-6 text-lg text-white/70 max-w-md">
              The complete operating system for luxury resale businesses.
              AI-driven, multi-tenant, enterprise-ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
