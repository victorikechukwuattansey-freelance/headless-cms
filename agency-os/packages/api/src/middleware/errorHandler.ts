// packages/api/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { logger } from '../lib/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(
      {
        err: {
          name: err.name,
          code: err.code,
          statusCode: err.statusCode,
          message: err.message,
        },
        method: req.method,
        path: req.originalUrl,
      },
      'Request failed'
    );

    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message }
    });
  }

  if (err instanceof ZodError) {
    logger.warn(
      {
        err: {
          name: err.name,
          issues: err.issues,
          message: err.message,
        },
        method: req.method,
        path: req.originalUrl,
      },
      'Validation failed'
    );

    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.flatten().fieldErrors
      }
    });
  }

  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'Record already exists' }
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Record not found' }
      });
    }
  }

  logger.error(
    {
      err,
      method: req.method,
      path: req.originalUrl,
    },
    'Unhandled API error'
  );

  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
  });
};
