import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(404, 'Not found'));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 10 MB limit' : err.message });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[error]', err);
  res.status(500).json({ error: message });
}
