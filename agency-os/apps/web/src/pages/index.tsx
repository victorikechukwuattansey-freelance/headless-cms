import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSignup } from '../hooks/useAuth';
import { PageShell } from '@/components/PageShell'; // see note below
import { useLogin } from '../hooks/useAuth';
import { apiClient } from '@agency-os/shared/service/client';
import { authApi } from '@agency-os/shared/service/services';


export function LoginPage() {
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <PageShell
      title="Welcome back"
      description="Sign in to manage users, security settings, and operational data."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2 text-sm text-gray-700">
          <span>Email</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block space-y-2 text-sm text-gray-700">
          <span>Password</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {login.error instanceof Error ? (
          <p className="text-sm text-red-600">{login.error.message}</p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          disabled={login.isPending}
        >
          {login.isPending ? 'Signing in...' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-slate-900 hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </PageShell>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  const signup = useSignup();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateField = (field: keyof typeof formData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
    if (validationError) setValidationError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    if (formData.password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    signup.mutate(
      {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      },
      {
        onSuccess: () => navigate('/verify', { replace: true }),
      }
    );
  };

  const errorMessage =
    validationError || (signup.error instanceof Error ? signup.error.message : null);

  return (
    <PageShell
      title="Team onboarding"
      description="Create your account to get started with the platform."
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={formData.name}
            onChange={updateField('name')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={formData.email}
            onChange={updateField('email')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={formData.password}
            onChange={updateField('password')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          <p className="text-xs text-gray-500">Must be at least 8 characters and contain uppercase, lowercase, and a number</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            value={formData.confirmPassword}
            onChange={updateField('confirmPassword')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

        <button
          type="submit"
          disabled={signup.isPending}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {signup.isPending ? 'Creating account...' : 'Create account'}
        </button>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-slate-900 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </PageShell>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <h1 className="text-6xl font-bold text-gray-900">404</h1>
      <p className="mt-4 text-lg text-gray-600">This page doesn't exist.</p>
      <a
        href="/dashboard"
        className="mt-6 text-sm font-medium text-blue-600 hover:underline"
      >
        Back to Dashboard
      </a>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      await apiClient.post('/auth/forgot-password', { email });
      setMessage('If the account exists, a reset link has been sent.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      title="Reset access"
      description="Send a recovery link to the email address associated with the account."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2 text-sm text-gray-700">
          <span>Email</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? 'Sending...' : 'Send recovery email'}
        </button>
      </form>
    </PageShell>
  );
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
    token ? 'pending' : 'idle',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('idle');
      setErrorMessage(null);
      return;
    }

    let cancelled = false;

    const verify = async () => {
      setStatus('pending');
      setErrorMessage(null);

      try {
        await authApi.verifyEmail(token);
        if (!cancelled) {
          setStatus('success');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to verify your email right now.',
          );
        }
      }
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const title =
    status === 'success'
      ? 'Email verified'
      : status === 'error'
        ? 'Verification failed'
        : token
          ? 'Verifying your email'
          : 'Check your email';

  const description =
    status === 'success'
      ? 'Your account is active. Sign in to continue.'
      : status === 'error'
        ? errorMessage || 'The verification link is invalid or has expired.'
        : token
          ? 'We are confirming your email address now.'
          : 'Open the verification link sent to your inbox to activate your account before signing in.';

  return (
    <PageShell title={title} description={description}>
      <div className="space-y-4 text-sm text-gray-600">
        {status === 'pending' ? (
          <p>Verifying your account...</p>
        ) : null}
        {status === 'idle' ? (
          <p>
            After you verify your email, you can return here and sign in with the account you just
            created.
          </p>
        ) : null}
        {status === 'error' ? (
          <p>If you opened an older email, use the latest verification link that was sent to you.</p>
        ) : null}
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/login"
            className="inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Go to login
          </Link>
          <Link
            to="/signup"
            className="inline-flex rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:text-gray-900"
          >
            Create another account
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

export function OverviewPage() {
  return (
    <PageShell
      title="Overview"
      description="Track onboarding, security posture, and team activity from one place."
    />
  );
}

export function AnalyticsPage() {
  return (
    <PageShell
      title="Analytics"
      description="Attach reporting widgets here once the data endpoints are available."
    />
  );
}

export function UsersPage() {
  return (
    <PageShell
      title="Users"
      description="Manage admin and manager accounts from this workspace."
    />
  );
}

export function SettingsPage() {
  return (
    <PageShell
      title="Settings"
      description="Configure integrations, password policies, and operational defaults."
    />
  );
}

export function AdminPage() {
  return (
    <PageShell
      title="Admin"
      description="Administrative controls are restricted to users with the ADMIN role."
    />
  );
}

export function UnauthorizedPage() {
  return (
    <PageShell
      title="Unauthorized"
      description="Your account does not have permission to access this route."
    />
  );
}
