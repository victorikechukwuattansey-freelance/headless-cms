import type { IncomingMessage } from 'node:http';
import type { DomainContext } from '../domain/domain-context.js';
import { requireOrganizationId } from '../domain/domain-context.js';
import { DomainError } from '../domain/domain-error.js';
import { AuthService } from '../services/auth.service.js';

export type AuthenticatedRequest = DomainContext;

const authService = new AuthService();

export function authenticate(req: IncomingMessage): AuthenticatedRequest {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    throw new DomainError('UNAUTHORIZED', 'Missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new DomainError('UNAUTHORIZED', 'Missing bearer token');
  }

  const claims = authService.verifyToken(token);
  const organizationId: string = claims.organizationId;
  requireOrganizationId(organizationId, 'authenticated request');
  return { userId: claims.userId, organizationId, role: claims.role };
}