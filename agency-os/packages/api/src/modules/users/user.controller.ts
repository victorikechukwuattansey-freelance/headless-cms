import { Response, NextFunction } from 'express';
import { sendSuccess } from '../../lib/response';
import { AuthRequest } from '../../middleware/authenticate';
import { AppError } from '../../middleware/errorHandler';
import { userService } from './user.service';

const getUserIdFromParams = (req: AuthRequest) => {
  const userId = req.params.id;
  if (typeof userId !== 'string') {
    throw new AppError(400, 'INVALID_USER_ID', 'User id is required');
  }

  return userId;
};

export const userController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const listUsersInput: Parameters<typeof userService.listUsers>[0] = {
        page:
          typeof req.query.page === 'number'
            ? req.query.page
            : Number(req.query.page ?? 1),
        limit:
          typeof req.query.limit === 'number'
            ? req.query.limit
            : Number(req.query.limit ?? 20),
      };

      if (typeof req.query.search === 'string') {
        listUsersInput.search = req.query.search;
      }

      if (req.query.role === 'USER' || req.query.role === 'MANAGER' || req.query.role === 'ADMIN') {
        listUsersInput.role = req.query.role;
      }

      if (typeof req.query.isActive === 'boolean') {
        listUsersInput.isActive = req.query.isActive;
      } else if (req.query.isActive === 'true' || req.query.isActive === 'false') {
        listUsersInput.isActive = req.query.isActive === 'true';
      }

      if (
        req.query.sortBy === 'createdAt' ||
        req.query.sortBy === 'updatedAt' ||
        req.query.sortBy === 'name' ||
        req.query.sortBy === 'email' ||
        req.query.sortBy === 'role'
      ) {
        listUsersInput.sortBy = req.query.sortBy;
      }

      if (req.query.sortOrder === 'asc' || req.query.sortOrder === 'desc') {
        listUsersInput.sortOrder = req.query.sortOrder;
      }

      const result = await userService.listUsers(listUsersInput);

      return sendSuccess(res, result);
    } catch (error) {
      return next(error);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = getUserIdFromParams(req);
      const user = await userService.getUserById(userId);
      return sendSuccess(res, user);
    } catch (error) {
      return next(error);
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await userService.createUser(req.body);
      return sendSuccess(res, user, 'User created', 201);
    } catch (error) {
      return next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = getUserIdFromParams(req);
      const user = await userService.updateUser(userId, req.body);
      return sendSuccess(res, user, 'User updated');
    } catch (error) {
      return next(error);
    }
  },

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = getUserIdFromParams(req);
      const result = await userService.softDeleteUser(userId, req.user!.userId);
      return sendSuccess(res, result, 'User deactivated and sessions revoked');
    } catch (error) {
      return next(error);
    }
  },
};
