import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { prisma } from "@awd/database";

export interface PromptListItem {
  id: string;
  title: string;
  version: number;
  status: string;
  tags: string[];
  updatedAt: Date;
  publishedAt: Date | null;
}

export interface PromptDetail extends PromptListItem {
  content: string;
  createdAt: Date;
}

@Injectable()
export class PromptsService {
  async list(organizationId: string): Promise<PromptListItem[]> {
    const prompts = await prisma.prompt.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return prompts.map((p) => ({
      id: p.id,
      title: p.title,
      version: p.version,
      status: p.status,
      tags: p.tags,
      updatedAt: p.updatedAt,
      publishedAt: p.publishedAt,
    }));
  }

  async get(organizationId: string, id: string): Promise<PromptDetail> {
    const prompt = await prisma.prompt.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!prompt) throw new NotFoundException("Prompt not found");
    return {
      id: prompt.id,
      title: prompt.title,
      content: prompt.content,
      version: prompt.version,
      status: prompt.status,
      tags: prompt.tags,
      updatedAt: prompt.updatedAt,
      publishedAt: prompt.publishedAt,
      createdAt: prompt.createdAt,
    };
  }

  async create(
    organizationId: string,
    userId: string,
    body: { title: string; content: string; tags?: string[] },
  ): Promise<PromptDetail> {
    if (!body.title?.trim()) throw new BadRequestException("title is required");
    if (!body.content?.trim()) throw new BadRequestException("content is required");
    const created = await prisma.prompt.create({
      data: {
        organizationId,
        title: body.title.trim(),
        content: body.content,
        version: 1,
        status: "DRAFT",
        tags: body.tags ?? [],
        createdById: userId,
      },
    });
    return this.get(organizationId, created.id);
  }

  async update(
    organizationId: string,
    id: string,
    body: { title?: string; content?: string; tags?: string[] },
  ): Promise<PromptDetail> {
    const existing = await prisma.prompt.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Prompt not found");
    if (body.content && body.content !== existing.content) {
      const updated = await prisma.prompt.update({
        where: { id },
        data: {
          title: body.title?.trim() || undefined,
          content: body.content,
          version: { increment: 1 },
          tags: body.tags ?? undefined,
          status: "DRAFT",
          publishedAt: null,
        },
      });
      return this.get(organizationId, updated.id);
    }
    const updated = await prisma.prompt.update({
      where: { id },
      data: {
        title: body.title?.trim() || undefined,
        tags: body.tags ?? undefined,
      },
    });
    return this.get(organizationId, updated.id);
  }

  async publish(organizationId: string, id: string): Promise<PromptDetail> {
    const existing = await prisma.prompt.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Prompt not found");
    const updated = await prisma.prompt.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    return this.get(organizationId, updated.id);
  }

  async remove(organizationId: string, id: string): Promise<{ id: string; deleted: boolean }> {
    const existing = await prisma.prompt.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Prompt not found");
    await prisma.prompt.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id, deleted: true };
  }
}
