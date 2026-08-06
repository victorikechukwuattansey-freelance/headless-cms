import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { prisma } from "@awd/database";
import { createHash, randomBytes } from "node:crypto";

export const API_KEY_PREFIX = "awd_live_";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyCreated {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  permissions: string[];
  expiresAt: Date | null;
}

const LIST_SELECT = {
  id: true,
  name: true,
  keyPrefix: true,
  permissions: true,
  expiresAt: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

@Injectable()
export class ApiKeysService {
  async list(organizationId: string): Promise<ApiKeyListItem[]> {
    const keys = await prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: LIST_SELECT,
    });
    return keys;
  }

  async create(
    organizationId: string,
    userId: string,
    input: { name: string; expiresAt?: string | null },
  ): Promise<ApiKeyCreated> {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("Name is required");

    let expiresAt: Date | null = null;
    if (input.expiresAt != null && input.expiresAt !== "") {
      const parsed = new Date(input.expiresAt);
      if (Number.isNaN(parsed.getTime())) throw new BadRequestException("Invalid expiresAt date");
      expiresAt = parsed;
    }

    const secret = randomBytes(32).toString("hex");
    const key = `${API_KEY_PREFIX}${secret}`;
    const created = await prisma.apiKey.create({
      data: {
        organizationId,
        name,
        hashedKey: hashKey(key),
        keyPrefix: key.slice(0, API_KEY_PREFIX.length + 4),
        permissions: ["*"],
        expiresAt,
        createdById: userId,
      },
      select: { ...LIST_SELECT, expiresAt: true },
    });
    return { ...created, key };
  }

  async revoke(organizationId: string, apiKeyId: string): Promise<{ id: string; revokedAt: Date }> {
    const existing = await prisma.apiKey.findFirst({
      where: { id: apiKeyId, organizationId },
    });
    if (!existing) throw new NotFoundException("API key not found");
    const updated = await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
      select: { id: true, revokedAt: true },
    });
    return { id: updated.id, revokedAt: updated.revokedAt ?? new Date() };
  }
}
