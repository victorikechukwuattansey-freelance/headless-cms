// packages/api/src/middleware/authorize.ts
import { Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { AuthRequest } from './authenticate';


export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
    next();
  };
};

// Usage: router.post('/', authenticate, authorize('ADMIN'), controller.create);