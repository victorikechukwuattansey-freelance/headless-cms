import type { DomainContext } from '../domain/domain-context.js';
import { DomainError } from '../domain/domain-error.js';

export type AppRole = 'USER' | 'AGENT' | 'ADMIN';

export function requireRole(context: DomainContext, roles: readonly AppRole[]): void {
  if (!roles.includes(context.role as AppRole)) {
    throw new DomainError('FORBIDDEN', `Insufficient permissions. Required role: ${roles.join(' or ')}`);
  }
}