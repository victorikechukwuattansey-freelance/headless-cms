import {
  createStorageService as _createStorageService,
  getStorageService as _getStorageService,
} from "./factory";
import type { StorageService as _StorageService } from "./service";
import { StorageError, UploadFailedError, FileNotFoundError } from "./types";
import type { UploadResult } from "./types";

export { _createStorageService as createStorageService, _getStorageService as getStorageService };
export type { _StorageService as StorageService };
export type { UploadResult };
export { StorageError, UploadFailedError, FileNotFoundError };

export type { _StorageService as StorageProvider };

const _service = _createStorageService();

export async function uploadFile(file: Buffer | Blob, path: string, contentType: string) {
  return _service.upload(file, path, contentType);
}

export async function deleteFile(key: string) {
  return _service.delete(key);
}

export async function getSignedUrl(key: string, expiresIn?: number) {
  return _service.getSignedUrl(key, expiresIn);
}

export async function getPublicUrl(key: string) {
  return _service.getPublicUrl(key);
}

export function getStorage(): _StorageService {
  return _service;
}

export const storage = {
  upload: uploadFile,
  delete: deleteFile,
  getSignedUrl,
  getPublicUrl,
};
