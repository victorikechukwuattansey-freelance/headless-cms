export interface DomainContext {
  userId: string;
  organizationId: string;
  role: 'USER' | 'AGENT' | 'ADMIN';
}

export function requireOrganizationId(organizationId: string, scope: string): string {
  if (!organizationId) {
    throw new Error(`Missing organizationId for ${scope}`);
  }
  return organizationId;
}

export function createDomainContext(
  input: { userId: string; organizationId: string; role: 'USER' | 'AGENT' | 'ADMIN' },
): DomainContext {
  requireOrganizationId(input.organizationId, 'domain context');
  return { userId: input.userId, organizationId: input.organizationId, role: input.role };
}