import path from 'node:path';
import { prisma } from '../db.js';
import { resolveProject } from './project.service.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface UploadMetadata {
  id: string;
  fileName: string;
  sourceFormat: string;
  sizeBytes: number;
  status: string;
  createdAt: Date;
}

type ValidationResult = { ok: true; sourceFormat: string } | { ok: false; error: string };

function decodeUtf8(buffer: Buffer): { ok: true; text: string } | { ok: false; error: string } {
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(buffer) };
  } catch {
    return { ok: false, error: 'File is not valid UTF-8 text.' };
  }
}

/** Count CSV fields in a row, honoring double-quoted fields. */
function countCsvFields(row: string): number {
  let fields = 0;
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (inQuotes) {
      if (c === '"') {
        if (row[i + 1] === '"') i++;
        else inQuotes = false;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields++;
    }
  }
  return fields + 1;
}

function validateCsv(text: string): string | null {
  const rows = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length === 0) return 'CSV file has no rows.';
  const counts = new Set(rows.map(countCsvFields));
  if (counts.size > 1) return 'CSV rows have inconsistent column counts.';
  return null;
}

/** Validate extension, size, encoding, and format-specific structure. */
export function validateUpload(fileName: string, buffer: Buffer): ValidationResult {
  const ext = path.extname(fileName).toLowerCase();
  if (ext !== '.json' && ext !== '.csv' && ext !== '.txt') {
    return { ok: false, error: `Unsupported file type "${ext || '(none)'}". Allowed: .json, .csv, .txt` };
  }
  if (buffer.length === 0) return { ok: false, error: 'File is empty.' };
  if (buffer.length > MAX_UPLOAD_BYTES) return { ok: false, error: 'File exceeds the 10 MB limit.' };

  const decoded = decodeUtf8(buffer);
  if (!decoded.ok) return decoded;

  const text = decoded.text.trim();
  if (!text) return { ok: false, error: 'File contains no content.' };

  if (ext === '.json') {
    try {
      JSON.parse(text);
    } catch {
      return { ok: false, error: 'Invalid JSON: the file does not parse.' };
    }
  } else if (ext === '.csv') {
    const csvError = validateCsv(text);
    if (csvError) return { ok: false, error: csvError };
  }

  return { ok: true, sourceFormat: ext.slice(1) };
}

/** Persist upload metadata only — the file content is discarded after validation. */
export async function storeUpload(fileName: string, sourceFormat: string, buffer: Buffer): Promise<UploadMetadata> {
  const project = await resolveProject();
  const safeName = path.basename(fileName);
  const log = await prisma.uploadedLog.create({
    data: {
      projectId: project.id,
      fileName: safeName,
      sourceFormat,
      sizeBytes: buffer.length,
      redactions: 0,
      status: 'uploaded',
    },
  });
  return {
    id: log.id,
    fileName: log.fileName,
    sourceFormat: log.sourceFormat,
    sizeBytes: log.sizeBytes,
    status: log.status,
    createdAt: log.createdAt,
  };
}

export async function listUploads(limit = 50) {
  return prisma.uploadedLog.findMany({
    where: { status: 'uploaded' },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
    select: {
      id: true,
      fileName: true,
      sourceFormat: true,
      sizeBytes: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function getUpload(id: string) {
  return prisma.uploadedLog.findUnique({
    where: { id },
    select: {
      id: true,
      fileName: true,
      sourceFormat: true,
      sizeBytes: true,
      status: true,
      createdAt: true,
    },
  });
}
