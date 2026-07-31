import { getEnv } from "@saas/config";
import type { StorageService } from "../service";
import type { UploadResult } from "../types";

const env = getEnv();

export class UploadThingAdapter implements StorageService {
  private baseUrl = "https://uploadthing.com";

  async upload(file: Buffer | Blob, path: string, contentType: string): Promise<UploadResult> {
    const formData = new FormData();
    const blob =
      file instanceof Blob ? file : new Blob([file as unknown as BlobPart], { type: contentType });
    formData.append("file", blob, path);

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: "POST",
      headers: {
        "x-uploadthing-secret": env.UPLOADTHING_SECRET ?? "",
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`UploadThing upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      url: result.url ?? this.getPublicUrl(result.key ?? path),
      key: result.key ?? path,
    };
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-uploadthing-secret": env.UPLOADTHING_SECRET ?? "",
      },
      body: JSON.stringify({ fileKey: key }),
    });

    if (!response.ok) {
      throw new Error(`UploadThing delete failed: ${response.statusText}`);
    }
  }

  async getSignedUrl(key: string, _expiresIn = 3600): Promise<string> {
    return this.getPublicUrl(key);
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/f/${key}`;
  }
}
