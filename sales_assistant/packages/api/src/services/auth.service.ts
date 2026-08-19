import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { DomainContext } from '../domain/domain-context.js';
import { DomainError } from '../domain/domain-error.js';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  context: DomainContext;
}

export interface TokenClaims {
  userId: string;
  organizationId: string;
  role: 'USER' | 'AGENT' | 'ADMIN';
  exp: number;
}

function jwtSecret(): string {
  return process.env.JWT_SECRET ?? 'dev-only-jwt-secret';
}

export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  async createSession(
    input: { userId: string; organizationId: string; role: 'USER' | 'AGENT' | 'ADMIN' },
  ): Promise<AuthSession> {
    const accessToken = randomBytes(32).toString('hex');
    const refreshToken = randomBytes(48).toString('hex');
    return {
      accessToken,
      refreshToken,
      refreshTokenHash: hashRefreshToken(refreshToken),
      context: { userId: input.userId, organizationId: input.organizationId, role: input.role },
    };
  }

  issueToken(input: { userId: string; organizationId: string; role: 'USER' | 'AGENT' | 'ADMIN'; ttlMs?: number }): string {
    const claims: TokenClaims = {
      userId: input.userId,
      organizationId: input.organizationId,
      role: input.role,
      exp: Date.now() + (input.ttlMs ?? 3_600_000),
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = createHmac('sha256', jwtSecret()).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  issueTokenWithExpiry(input: {
    userId: string;
    organizationId: string;
    role: 'USER' | 'AGENT' | 'ADMIN';
    ttlMs?: number;
  }): { token: string; expiresAt: string } {
    const ttlMs = input.ttlMs ?? 3_600_000;
    return {
      token: this.issueToken({ ...input, ttlMs }),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    };
  }

  verifyToken(token: string): TokenClaims {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new DomainError('UNAUTHORIZED', 'Malformed token');
    }
    const [payload, signature] = parts;
    const expected = createHmac('sha256', jwtSecret()).update(payload).digest('base64url');
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new DomainError('UNAUTHORIZED', 'Invalid token signature');
    }
    let claims: TokenClaims;
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenClaims;
    } catch {
      throw new DomainError('UNAUTHORIZED', 'Malformed token payload');
    }
    if (typeof claims.exp !== 'number' || claims.exp < Date.now()) {
      throw new DomainError('UNAUTHORIZED', 'Token expired');
    }
    return claims;
  }
}