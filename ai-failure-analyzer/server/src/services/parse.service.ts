import { prisma } from '../db.js';
import type { TimelineEntry } from '../domain/types.js';
import { ApiError } from '../middleware/error.middleware.js';
import { parseLog } from './parser.service.js';
import { buildExecutionTimeline, type ExecutionStep } from './timeline.service.js';
import { validateUpload } from './upload.service.js';

export interface ParsedExecutionView {
  id: string;
  uploadedLogId: string;
  sourceFormat: string;
  stepCount: number;
  steps: ExecutionStep[];
  createdAt: Date;
}

/** Convert a previously uploaded log into a stored, redacted execution timeline. */
export async function parseUploadedLog(uploadId: string, fileName: string, buffer: Buffer): Promise<ParsedExecutionView> {
  const upload = await prisma.uploadedLog.findUnique({ where: { id: uploadId } });
  if (!upload) throw new ApiError(404, 'Upload not found');
  if (upload.status !== 'uploaded') {
    throw new ApiError(409, upload.status === 'analyzed' ? 'Upload is already analyzed' : 'Upload is already parsed');
  }
  if (upload.fileName !== fileName || upload.sizeBytes !== buffer.length) {
    throw new ApiError(400, 'File does not match the stored upload (name or size differs). Send the original file.');
  }

  const validation = validateUpload(fileName, buffer);
  if (!validation.ok) throw new ApiError(400, validation.error);

  const parsed = parseLog(buffer.toString('utf-8'));
  if (parsed.timeline.length === 0) {
    throw new ApiError(400, 'Could not extract any steps from the log.');
  }

  const execution = await prisma.parsedExecution.create({
    data: { uploadedLogId: upload.id, steps: parsed.timeline as unknown as object },
  });
  await prisma.uploadedLog.update({
    where: { id: upload.id },
    data: { status: 'parsed', redactions: parsed.redactions },
  });

  return {
    id: execution.id,
    uploadedLogId: upload.id,
    sourceFormat: upload.sourceFormat,
    stepCount: parsed.timeline.length,
    steps: buildExecutionTimeline(parsed.timeline),
    createdAt: execution.createdAt,
  };
}

/** Read a stored execution timeline for an upload. */
export async function getParsedExecution(uploadId: string): Promise<ParsedExecutionView> {
  const upload = await prisma.uploadedLog.findUnique({ where: { id: uploadId }, include: { execution: true } });
  if (!upload) throw new ApiError(404, 'Upload not found');
  if (!upload.execution) throw new ApiError(404, 'Upload has not been parsed yet');

  const steps = upload.execution.steps as unknown as TimelineEntry[];
  return {
    id: upload.execution.id,
    uploadedLogId: upload.id,
    sourceFormat: upload.sourceFormat,
    stepCount: steps.length,
    steps: buildExecutionTimeline(steps),
    createdAt: upload.execution.createdAt,
  };
}
