// packages/api/src/middleware/authenticate.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export const authenticate = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const authorizationHeader = req.headers.authorization;
    const token = authorizationHeader?.startsWith('Bearer ')
      ? authorizationHeader.slice('Bearer '.length)
      : undefined;

    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Access token required');
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string; role: string };
    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is inactive');
    }

    req.user = { userId: user.id, role: user.role };
    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }
};

