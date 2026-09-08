import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestRoute } from './GuestRoute';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { AuthLayout } from '../components/layout/AuthLayout';
import {
  AdminPage,
  AnalyticsPage,
  ForgotPasswordPage,
  LoginPage,
  NotFoundPage,
  OverviewPage,
  SettingsPage,
  SignupPage,
  UnauthorizedPage,
  UsersPage,
  VerifyEmailPage,
} from '@/pages';

export const router = createBrowserRouter([
  // Root redirect
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },

  // Public auth shell
  {
    element: <AuthLayout />,
    children: [
      { path: '/verify', element: <VerifyEmailPage /> },
      {
        element: <GuestRoute />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignupPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
    ],
  },

  // Protected app shell (auth required + shared dashboard layout)
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          // Core pages
          { path: '/dashboard', element: <OverviewPage /> },
          { path: '/dashboard/analytics', element: <AnalyticsPage /> },
          { path: '/dashboard/settings', element: <SettingsPage /> },

          // Admin-only (nested inside shared layout, but with role guard)
          {
            element: <ProtectedRoute allowedRoles={['ADMIN']} />,
            children: [
              { path: '/dashboard/users', element: <UsersPage /> },
              { path: '/admin', element: <AdminPage /> },
            ],
          },

          // Accessible to all authenticated users
          { path: '/unauthorized', element: <UnauthorizedPage /> },
        ],
      },
    ],
  },

  // 404 catch-all
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
