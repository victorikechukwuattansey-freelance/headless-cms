import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface Props {
  redirectTo?: string;
}

export function GuestRoute({ redirectTo = '/dashboard' }: Props) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) return <Navigate to={redirectTo} replace />;

  return <Outlet />;
}