import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../lib/response';
import { AppError } from '../../middleware/errorHandler';
import { authService } from './auth.service';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.register(req.body.email, req.body.name, req.body.password);
      return sendSuccess(res, user, 'Registration successful', 201);
    } catch (error) {
      return next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body.email, req.body.password);
      return sendSuccess(res, result, 'Login successful');
    } catch (error) {
      return next(error);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refreshToken ?? req.cookies?.refreshToken;
      if (typeof refreshToken !== "string") {
      throw new Error("Refresh token is required");
    }
      const result = await authService.refresh(refreshToken);
      return sendSuccess(res, result, 'Token refreshed');
    } catch (error) {
      return next(error);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.body.refreshToken ?? req.cookies?.refreshToken;
      if (typeof refreshToken !== "string") {
        throw new Error("Refresh token is required");
      }
      await authService.logout(refreshToken);
      return sendSuccess(res, null, 'Logged out');
    } catch (error) {
      return next(error);
    }
  },

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.params.token;
      if (typeof token !== 'string') {
        throw new AppError(400, 'INVALID_TOKEN', 'Verification token is required');
      }
      await authService.verifyEmail(token);
      return sendSuccess(res, null, 'Email verified');
    } catch (error) {
      return next(error);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.forgotPassword(req.body.email);
      return sendSuccess(res, null, 'If the account exists, a reset link has been sent');
    } catch (error) {
      return next(error);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.resetPassword(req.body.token, req.body.password);
      return sendSuccess(res, null, 'Password reset successful');
    } catch (error) {
      return next(error);
    }
  },
};
