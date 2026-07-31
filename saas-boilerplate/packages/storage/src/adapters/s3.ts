import { getEnv } from "@saas/config";
import type { StorageService } from "../service";
import type { UploadResult } from "../types";

const env = getEnv();

export class S3StorageAdapter implements StorageService {
  private s3Client: any;
  private bucket: string;

  constructor() {
    const { S3Client } = require("@aws-sdk/client-s3");
    this.bucket = env.AWS_BUCKET_NAME ?? "saas-uploads";
    this.s3Client = new S3Client({
      region: env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });
  }

  async upload(file: Buffer | Blob, path: string, contentType: string): Promise<UploadResult> {
    const { PutObjectCommand } = require("@aws-sdk/client-s3");
    const buffer = file instanceof Blob ? Buffer.from(await file.arrayBuffer()) : file;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return { url: this.getPublicUrl(path), key: path };
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    return getSignedUrl(this.s3Client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn,
    });
  }

  getPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  }
}
