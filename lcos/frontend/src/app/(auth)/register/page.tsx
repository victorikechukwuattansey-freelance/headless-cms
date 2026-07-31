'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shirt } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    organizationName: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push('/dashboard');
    }, 1000);
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2">
            <Shirt className="h-8 w-8 text-luxury-gold" />
            <span className="font-display text-2xl font-bold">LCOS</span>
          </div>
          <h2 className="mt-8 text-2xl font-bold leading-9 tracking-tight">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Start your luxury commerce journey
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">First name</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Last name</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Business name</label>
              <input
                type="text"
                value={form.organizationName}
                onChange={(e) => update('organizationName', e.target.value)}
                className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                placeholder="My Boutique"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                className="mt-1 block w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold"
                placeholder="Min 6 characters"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <a href="/login" className="font-semibold text-foreground hover:text-luxury-gold">
                Sign in
              </a>
            </p>
          </form>
        </div>
      </div>

      <div className="relative hidden flex-1 lg:block">
        <div className="absolute inset-0 luxury-gradient" />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center text-white">
            <h1 className="font-display text-5xl font-bold">Built for</h1>
            <h2 className="mt-2 font-display text-4xl font-bold text-luxury-gold">
              Luxury Resellers
            </h2>
            <p className="mt-6 text-lg text-white/70 max-w-md">
              Join the platform trusted by premium boutiques and luxury resellers worldwide.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
