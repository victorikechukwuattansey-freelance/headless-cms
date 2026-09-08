import { z } from 'zod';

const roleSchema = z.enum(['USER', 'MANAGER', 'ADMIN']);
const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    search: z.string().trim().optional(),
    role: roleSchema.optional(),
    isActive: booleanQuery.optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'email', 'role']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const userParamsSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email(),
    name: z.string().trim().min(2).max(80),
    password: z.string().min(8),
    role: roleSchema.default('USER'),
    isActive: z.boolean().optional(),
    isEmailVerified: z.boolean().optional(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z
    .object({
      email: z.string().email().optional(),
      name: z.string().trim().min(2).max(80).optional(),
      password: z.string().min(8).optional(),
      role: roleSchema.optional(),
      isActive: z.boolean().optional(),
      isEmailVerified: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field must be supplied',
    }),
});

