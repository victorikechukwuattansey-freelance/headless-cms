import { getEnv } from "@saas/config";
import type { StorageService } from "./service";
import { S3StorageAdapter } from "./adapters/s3";
import { UploadThingAdapter } from "./adapters/uploadthing";

let instance: StorageService | null = null;

export function createStorageService(): StorageService {
  if (instance) return instance;

  const env = getEnv();
  const provider = env.STORAGE_PROVIDER ?? "s3";

  switch (provider) {
    case "s3":
      instance = new S3StorageAdapter();
      break;
    case "uploadthing":
      instance = new UploadThingAdapter();
      break;
    default:
      instance = new S3StorageAdapter();
  }

  return instance;
}

export function getStorageService(): StorageService {
  return createStorageService();
}
