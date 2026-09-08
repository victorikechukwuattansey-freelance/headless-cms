import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { analyzeLog } from '../services/analyze.service.js';
import { ApiError } from '../middleware/error.middleware.js';
import { createFileUpload } from '../middleware/upload.middleware.js';

const upload = createFileUpload(/\.(json|jsonl|ndjson|txt|log)$/i, 'log');

const jsonBodySchema = z.object({
  log: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
});

async function runAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let input: unknown;
    if (req.file) {
      input = req.file.buffer.toString('utf-8');
    } else {
      const parsed = jsonBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(400, 'Send a file (multipart field "log") or JSON body {"log": <string|object|array>}');
      }
      input = parsed.data.log;
    }

    const result = await analyzeLog(input);
    res.status(201).json({
      id: result.id,
      createdAt: result.createdAt,
      failure: result.failure,
      timeline: result.timeline,
      redactions: result.redactions,
    });
  } catch (err) {
    next(err);
  }
}

export function analyzeRouter(): Router {
  const router = Router();
  router.post('/analyze', upload.single('log'), runAnalysis);
  return router;
}
