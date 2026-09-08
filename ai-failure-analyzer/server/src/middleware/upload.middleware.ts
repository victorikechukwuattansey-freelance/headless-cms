import multer from 'multer';
import { ApiError } from './error.middleware.js';
import { MAX_UPLOAD_BYTES } from '../services/upload.service.js';

export function createFileUpload(allowedExtensions: RegExp, fieldName = 'file'): multer.Multer {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_req, file, cb) => {
      if (allowedExtensions.test(file.originalname)) cb(null, true);
      else cb(new ApiError(400, `Unsupported file type "${file.originalname}"`));
    },
  });
}
