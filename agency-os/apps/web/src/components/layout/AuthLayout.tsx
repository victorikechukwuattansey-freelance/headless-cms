import { Outlet } from 'react-router-dom';

const appName = import.meta.env.VITE_APP_NAME || 'Agency OS';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <section className="hidden flex-1 bg-slate-900 p-10 text-white md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-slate-300">Platform</p>
            <h1 className="mt-4 text-4xl font-semibold">{appName}</h1>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-300">
            Manage agency operations, team access, and account security from a single control
            surface.
          </p>
        </section>
        <section className="flex w-full items-center justify-center p-6 md:w-[32rem] md:p-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </section>
      </div>
    </div>
  );
}
