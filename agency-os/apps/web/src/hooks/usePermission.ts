import { useAuthStore } from '../store/authStore';
import type { Role } from '@agency-os/shared/types/api';

export function usePermission(required: Role | Role[]) {
  const role = useAuthStore((s) => s.user?.role);
  const roles = Array.isArray(required) ? required : [required];
  return role ? roles.includes(role) : false;
}
