import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import type { DomainContext } from '../domain/domain-context.js';
import { DomainError } from '../domain/domain-error.js';
import { decryptSecret, encryptSecret } from '../integrations/integration-gateway.service.js';
import { writeAuditEvent } from './audit.service.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface StoreTokenInput {
  provider: string;
  plaintextToken: string;
}

export class IntegrationTokenService {
  async store(context: DomainContext, input: StoreTokenInput) {
    const provider = input.provider.trim();
    if (!provider || !input.plaintextToken) {
      throw new DomainError('VALIDATION', 'Provider and plaintext token are required');
    }
    const encrypted = encryptSecret(input.plaintextToken);
    const storedValue = `${encrypted.iv}.${encrypted.ciphertext}`;
    const token = await prisma.integrationToken.create({
      data: {
        organizationId: context.organizationId,
        provider,
        encryptedAccessToken: storedValue,
        encryptionKeyVersion: encrypted.keyVersion ?? 1,
        tokenHash: sha256(input.plaintextToken),
      },
      select: { id: true, provider: true, encryptionKeyVersion: true, createdAt: true },
    });
    await writeAuditEvent(context, 'INTEGRATION_TOKEN_STORED', {
      tokenId: token.id,
      provider: token.provider,
    });
    return token;
  }

  async list(context: DomainContext) {
    return prisma.integrationToken.findMany({
      where: { organizationId: context.organizationId },
      select: { id: true, provider: true, encryptionKeyVersion: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async retrieve(context: DomainContext, tokenId: string) {
    const token = await prisma.integrationToken.findFirst({
      where: { id: tokenId, organizationId: context.organizationId },
    });
    if (!token || !token.encryptedAccessToken) {
      throw new DomainError('NOT_FOUND', 'Integration token not found');
    }
    const [iv, ciphertext] = token.encryptedAccessToken.split('.');
    const plaintext = decryptSecret({ iv, ciphertext });
    return { id: token.id, provider: token.provider, plaintextToken: plaintext };
  }

  async delete(context: DomainContext, tokenId: string) {
    const token = await prisma.integrationToken.findFirst({
      where: { id: tokenId, organizationId: context.organizationId },
    });
    if (!token) throw new DomainError('NOT_FOUND', 'Integration token not found');
    await prisma.integrationToken.delete({ where: { id: token.id } });
    await writeAuditEvent(context, 'INTEGRATION_TOKEN_DELETED', {
      tokenId: token.id,
      provider: token.provider,
    });
  }
}