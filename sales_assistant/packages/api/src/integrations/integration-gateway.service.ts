import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function secretKey(): Buffer {
  const secret = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('INTEGRATION_TOKEN_ENCRYPTION_KEY is not configured; refusing to encrypt or decrypt integration tokens');
  }
  return createHash('sha256').update(secret).digest();
}

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  keyVersion?: number;
}

export function encryptSecret(plainText: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString('base64'),
    iv: iv.toString('base64'),
    keyVersion: 1,
  };
}

export function decryptSecret(payload: EncryptedSecret): string {
  const iv = Buffer.from(payload.iv, 'base64');
  const buf = Buffer.from(payload.ciphertext, 'base64');
  const tag = buf.subarray(buf.length - 16);
  const encrypted = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}