import { requireOrganizationId } from './domain-context.js';
import { DomainError } from './domain-error.js';

export interface OrganizationScoped {
  organizationId?: string | null;
}

export function assertSameOrganization(
  contextOrganizationId: string,
  resource: OrganizationScoped,
  resourceType: string,
): void {
  requireOrganizationId(contextOrganizationId, 'resource policy');
  if (resource.organizationId == null) {
    throw new DomainError('FORBIDDEN', `Resource ${resourceType} is not scoped to an organization`);
  }
  if (resource.organizationId !== contextOrganizationId) {
    throw new DomainError('FORBIDDEN', `Resource ${resourceType} belongs to a different organization`);
  }
}