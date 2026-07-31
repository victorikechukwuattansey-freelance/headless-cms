import type { UploadResult } from "./types";

export interface StorageService {
  upload(file: Buffer | Blob, path: string, contentType: string): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  getPublicUrl(key: string): string;
}
