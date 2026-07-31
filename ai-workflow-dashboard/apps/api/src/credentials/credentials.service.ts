import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { prisma } from "@awd/database";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { loadEnv } from "@awd/config";

const env = loadEnv();

function masterKey(): Buffer {
  let raw = env.VAULT_MASTER_KEY;
  if (raw.startsWith("base64:")) {
    raw = Buffer.from(raw.slice(7), "base64").toString("utf8");
  }
  return createHash("sha256").update(raw).digest();
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted payload");
  }
  const iv = Buffer.from(parts[1]!, "base64");
  const tag = Buffer.from(parts[2]!, "base64");
  const data = Buffer.from(parts[3]!, "base64");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export interface CredentialListItem {
  id: string;
  name: string;
  provider: string;
  status: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CredentialDetail extends CredentialListItem {
  secret: string;
}

const LIST_SELECT = {
  id: true,
  name: true,
  provider: true,
  status: true,
  expiresAt: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CredentialsService {
  async list(organizationId: string): Promise<CredentialListItem[]> {
    return prisma.credential.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: LIST_SELECT,
    });
  }

  async get(organizationId: string, id: string): Promise<CredentialListItem> {
    const credential = await prisma.credential.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!credential) throw new NotFoundException("Credential not found");
    return {
      id: credential.id,
      name: credential.name,
      provider: credential.provider,
      status: credential.status,
      expiresAt: credential.expiresAt,
      lastUsedAt: credential.lastUsedAt,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }

  async getSecret(organizationId: string, id: string): Promise<CredentialDetail> {
    const credential = await prisma.credential.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!credential) throw new NotFoundException("Credential not found");
    let secret = "";
    try {
      secret = decrypt(credential.encryptedSecretRef);
    } catch {
      throw new BadRequestException("Credential could not be decrypted");
    }
    const touched = await prisma.credential.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
    return {
      id: credential.id,
      name: credential.name,
      provider: credential.provider,
      status: credential.status,
      expiresAt: credential.expiresAt,
      lastUsedAt: touched.lastUsedAt,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
      secret,
    };
  }

  async create(
    organizationId: string,
    userId: string,
    body: { name: string; provider: string; secret: string; expiresAt?: string },
  ): Promise<CredentialListItem> {
    if (!body.name?.trim()) throw new BadRequestException("name is required");
    if (!body.provider?.trim()) throw new BadRequestException("provider is required");
    if (!body.secret) throw new BadRequestException("secret is required");
    const encrypted = encrypt(body.secret);
    const created = await prisma.credential.create({
      data: {
        organizationId,
        name: body.name.trim(),
        provider: body.provider.trim().toLowerCase(),
        encryptedSecretRef: encrypted,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdById: userId,
      },
      select: LIST_SELECT,
    });
    return created;
  }

  async update(
    organizationId: string,
    id: string,
    body: { name?: string; provider?: string; secret?: string; status?: string; expiresAt?: string | null },
  ): Promise<CredentialListItem> {
    const existing = await prisma.credential.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Credential not found");
    const updated = await prisma.credential.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        provider: body.provider?.trim().toLowerCase() || undefined,
        status: (body.status as "ACTIVE" | "REVOKED" | "EXPIRED") || undefined,
        expiresAt: body.expiresAt === null ? null : body.expiresAt ? new Date(body.expiresAt) : undefined,
        encryptedSecretRef: body.secret ? encrypt(body.secret) : undefined,
      },
      select: LIST_SELECT,
    });
    return updated;
  }

  async remove(organizationId: string, id: string): Promise<{ id: string; deleted: boolean }> {
    const existing = await prisma.credential.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Credential not found");
    await prisma.credential.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }
}
