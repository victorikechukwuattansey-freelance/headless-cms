import { prisma } from '../lib/prisma.js';
import type { DomainContext } from '../domain/domain-context.js';
import { DomainError } from '../domain/domain-error.js';
import { AuthService } from './auth.service.js';
import { writeAuditEvent } from './audit.service.js';

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role?: 'USER' | 'AGENT' | 'ADMIN';
}

export interface UpdateUserInput {
  password?: string;
  role?: 'USER' | 'AGENT' | 'ADMIN';
}

export interface UserListOptions {
  limit: number;
  offset: number;
}

const SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  organizationId: true,
  createdAt: true,
} as const;

const auth = new AuthService();

export class UserService {
  async list(context: DomainContext, options: UserListOptions) {
    const where = { organizationId: context.organizationId };
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: SAFE_SELECT,
        orderBy: { createdAt: 'asc' },
        skip: options.offset,
        take: options.limit,
      }),
      prisma.user.count({ where }),
    ]);
    return { data, total };
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async getScoped(context: DomainContext, userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId: context.organizationId },
    });
    if (!user) throw new DomainError('NOT_FOUND', 'User not found');
    return user;
  }

  async create(context: DomainContext, input: CreateUserInput) {
    const passwordHash = await auth.hashPassword(input.password);
    try {
      const user = await prisma.user.create({
        data: {
          organizationId: context.organizationId,
          email: input.email.trim().toLowerCase(),
          name: input.name?.trim() || null,
          role: input.role ?? 'USER',
          passwordHash,
        },
        select: SAFE_SELECT,
      });
      await writeAuditEvent(context, 'USER_CREATED', { userId: user.id, email: user.email, role: user.role });
      return user;
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'P2002') {
        throw new DomainError('VALIDATION', 'A user with this email already exists');
      }
      throw err;
    }
  }

  async update(context: DomainContext, userId: string, input: UpdateUserInput) {
    const user = await this.getScoped(context, userId);
    const userUpdate: Record<string, unknown> = {};
    if (input.role !== undefined) userUpdate.role = input.role;
    if (input.password !== undefined) userUpdate.passwordHash = await auth.hashPassword(input.password);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: userUpdate,
      select: SAFE_SELECT,
    });
    await writeAuditEvent(context, 'USER_UPDATED', { userId: updated.id, email: updated.email });
    return updated;
  }
}