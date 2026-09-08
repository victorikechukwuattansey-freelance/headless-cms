// packages/api/src/lib/crudFactory.ts
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendSuccess } from './response';

const prisma = new PrismaClient();

export function createCrudController(model: keyof PrismaClient, searchFields: string[] = []) {
  return {
    getAll: async (req: Request, res: Response) => {
      const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = search && searchFields.length > 0
        ? { OR: searchFields.map(f => ({ [f]: { contains: search, mode: 'insensitive' } })) }
        : {};

      const [items, total] = await Promise.all([
        (prisma[model] as any).findMany({
          where, skip, take: Number(limit),
          orderBy: { [sortBy as string]: sortOrder }
        }),
        (prisma[model] as any).count({ where })
      ]);

      sendSuccess(res, { items, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    },

    getById: async (req: Request, res: Response) => {
      const item = await (prisma[model] as any).findUniqueOrThrow({ where: { id: req.params.id } });
      sendSuccess(res, item);
    },

    create: async (req: Request, res: Response) => {
      const item = await (prisma[model] as any).create({ data: req.body });
      sendSuccess(res, item, 'Created successfully', 201);
    },

    update: async (req: Request, res: Response) => {
      const item = await (prisma[model] as any).update({
        where: { id: req.params.id }, data: req.body
      });
      sendSuccess(res, item, 'Updated successfully');
    },

    delete: async (req: Request, res: Response) => {
      await (prisma[model] as any).delete({ where: { id: req.params.id } });
      sendSuccess(res, null, 'Deleted successfully');
    }
  };
}

// Usage:
// const usersController = createCrudController('user', ['name', 'email']);