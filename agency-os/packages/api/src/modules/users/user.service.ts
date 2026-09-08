import bcrypt from 'bcryptjs';
import { type Prisma, type Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/errorHandler';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MIN_SEARCH_LENGTH = 2;

const baseUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  isEmailVerified: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type ListUsersInput = {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'email' | 'role';
  sortOrder?: 'asc' | 'desc';
};

type CreateUserInput = {
  email: string;
  name: string;
  password: string;
  role?: Role;
  isActive?: boolean;
  isEmailVerified?: boolean;
};

type UpdateUserInput = Partial<CreateUserInput>;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const buildSearchFilter = (search?: string): Prisma.UserWhereInput | undefined => {
  if (!search) {
    return undefined;
  }

  const term = search.trim();
  if (term.length < MIN_SEARCH_LENGTH) {
    return undefined;
  }

  return {
    OR: [
      { name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ],
  };
};

export const userService = {
  async listUsers(input: ListUsersInput) {
    const page = Math.max(1, input.page || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(input.role ? { role: input.role } : {}),
      ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
      ...(buildSearchFilter(input.search) || {}),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [input.sortBy || 'createdAt']: input.sortOrder || 'desc',
    };

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: baseUserSelect,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async getUserById(id: string) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: baseUserSelect,
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    return user;
  },

  async createUser(input: CreateUserInput) {
    const hashedPassword = await bcrypt.hash(input.password, 12);

    return prisma.user.create({
      data: {
        email: normalizeEmail(input.email),
        name: input.name.trim(),
        password: hashedPassword,
        role: input.role || 'USER',
        isActive: input.isActive ?? true,
        isEmailVerified: input.isEmailVerified ?? false,
      },
      select: baseUserSelect,
    });
  },

  async updateUser(id: string, input: UpdateUserInput) {
    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const data: Prisma.UserUpdateInput = {};

    if (input.email) {
      data.email = normalizeEmail(input.email);
    }
    if (input.name) {
      data.name = input.name.trim();
    }
    if (input.password) {
      data.password = await bcrypt.hash(input.password, 12);
    }
    if (input.role) {
      data.role = input.role;
    }
    if (typeof input.isActive === 'boolean') {
      data.isActive = input.isActive;
    }
    if (typeof input.isEmailVerified === 'boolean') {
      data.isEmailVerified = input.isEmailVerified;
    }

    return prisma.user.update({
      where: { id },
      data,
      select: baseUserSelect,
    });
  },

  async softDeleteUser(id: string, actingUserId: string) {
    if (id === actingUserId) {
      throw new AppError(400, 'INVALID_OPERATION', 'You cannot delete your own account');
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id, deletedAt: null },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!existing) {
        throw new AppError(404, 'NOT_FOUND', 'User not found');
      }

      const revokedSessions = await tx.refreshToken.deleteMany({
        where: { userId: id },
      });

      const deletedUser = await tx.user.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt: new Date(),
          emailVerifyToken: null,
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
        select: baseUserSelect,
      });

      return {
        user: deletedUser,
        revokedSessions: revokedSessions.count,
      };
    });
  },
};

