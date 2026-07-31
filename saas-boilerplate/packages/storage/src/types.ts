export interface UploadResult {
  url: string;
  key: string;
  signedUrl?: string;
}

export type StorageProviderType = "s3" | "uploadthing";

export class StorageError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export class UploadFailedError extends StorageError {
  constructor() {
    super("UPLOAD_FAILED", "File upload failed");
  }
}

export class FileNotFoundError extends StorageError {
  constructor() {
    super("FILE_NOT_FOUND", "File not found");
  }
}
