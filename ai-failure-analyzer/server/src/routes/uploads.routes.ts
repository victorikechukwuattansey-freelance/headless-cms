import { Router, type NextFunction, type Request, type Response } from 'express';
import { ApiError } from '../middleware/error.middleware.js';
import { createFileUpload } from '../middleware/upload.middleware.js';
import { getParsedExecution, parseUploadedLog } from '../services/parse.service.js';
import { getUpload, listUploads, storeUpload, validateUpload } from '../services/upload.service.js';

const upload = createFileUpload(/\.(json|csv|txt)$/i, 'file');

export const uploadsRouter = Router();

uploadsRouter.post('/uploads', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'No file received. Send a file in the multipart field "file" (.json, .csv, .txt).');
    }
    const validation = validateUpload(req.file.originalname, req.file.buffer);
    if (!validation.ok) {
      throw new ApiError(400, validation.error);
    }
    const metadata = await storeUpload(req.file.originalname, validation.sourceFormat, req.file.buffer);
    res.status(201).json(metadata);
  } catch (err) {
    next(err);
  }
});

uploadsRouter.get('/uploads', async (_req, res, next) => {
  try {
    res.json({ uploads: await listUploads() });
  } catch (err) {
    next(err);
  }
});

uploadsRouter.get('/uploads/:id', async (req, res, next) => {
  try {
    const upload = await getUpload(req.params.id);
    if (!upload) throw new ApiError(404, 'Upload not found');
    res.json(upload);
  } catch (err) {
    next(err);
  }
});

uploadsRouter.post('/uploads/:id/parse', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'No file received. Send the original file in the multipart field "file".');
    }
    const result = await parseUploadedLog(req.params.id, req.file.originalname, req.file.buffer);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

uploadsRouter.get('/uploads/:id/execution', async (req, res, next) => {
  try {
    res.json(await getParsedExecution(req.params.id));
  } catch (err) {
    next(err);
  }
});
