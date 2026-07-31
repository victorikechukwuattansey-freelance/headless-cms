import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { prisma } from "@awd/database";
import { createHash } from "node:crypto";
import { loadEnv } from "@awd/config";

const env = loadEnv();

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const step = Math.max(1, chunkSize - overlap);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += step) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    const av = a[i];
    const bv = b[i];
    if (av === undefined || bv === undefined) continue;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface SearchResult {
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  score: number;
}

@Injectable()
export class RagService {
  private async embed(text: string, model: string): Promise<number[]> {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) {
      throw new BadRequestException(`Embedding provider failed (${res.status})`);
    }
    const data = (await res.json()) as { embedding?: number[] };
    if (!data.embedding) throw new BadRequestException("Embedding provider returned no vector");
    return data.embedding;
  }

  async list(organizationId: string) {
    return prisma.knowledgeBase.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { documents: true } } },
    });
  }

  async get(organizationId: string, id: string) {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        documents: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { chunks: true } } },
        },
      },
    });
    if (!kb) throw new NotFoundException("Knowledge base not found");
    return kb;
  }

  async create(
    organizationId: string,
    userId: string,
    body: { name: string; description?: string; chunkSize?: number; chunkOverlap?: number; embeddingModel?: string },
  ) {
    if (!body.name?.trim()) throw new BadRequestException("name is required");
    return prisma.knowledgeBase.create({
      data: {
        organizationId,
        name: body.name.trim(),
        description: body.description ?? null,
        chunkSize: body.chunkSize ?? 512,
        chunkOverlap: body.chunkOverlap ?? 64,
        embeddingModel: body.embeddingModel ?? "nomic-embed-text",
        createdById: userId,
      },
    });
  }

  async remove(organizationId: string, id: string): Promise<{ id: string; deleted: boolean }> {
    const kb = await prisma.knowledgeBase.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!kb) throw new NotFoundException("Knowledge base not found");
    await prisma.knowledgeBase.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  async addDocument(
    organizationId: string,
    knowledgeBaseId: string,
    body: { filename: string; content: string },
  ): Promise<{ id: string; filename: string; chunkCount: number }> {
    if (!body.filename?.trim()) throw new BadRequestException("filename is required");
    if (!body.content?.trim()) throw new BadRequestException("content is required");
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId, deletedAt: null },
    });
    if (!kb) throw new NotFoundException("Knowledge base not found");

    const chunks = chunkText(body.content, kb.chunkSize, kb.chunkOverlap);
    if (chunks.length === 0) throw new BadRequestException("content produced no chunks");

    const vectors = await Promise.all(chunks.map((c) => this.embed(c, kb.embeddingModel)));

    const document = await prisma.knowledgeDocument.create({
      data: {
        knowledgeBaseId,
        filename: body.filename.trim(),
        mimeType: "text/plain",
        size: Buffer.byteLength(body.content, "utf8"),
        checksum: createHash("sha256").update(body.content).digest("hex"),
        indexedAt: new Date(),
        chunks: {
          create: vectors.map((embedding, i) => ({
            chunkIndex: i,
            content: chunks[i]!,
            embedding: embedding as unknown as object,
            metadata: { source: body.filename.trim() },
          })),
        },
      },
    });

    return { id: document.id, filename: document.filename, chunkCount: chunks.length };
  }

  async search(
    organizationId: string,
    knowledgeBaseId: string,
    body: { query: string; topK?: number },
  ): Promise<SearchResult[]> {
    if (!body.query?.trim()) throw new BadRequestException("query is required");
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, organizationId, deletedAt: null },
      include: {
        documents: {
          where: { deletedAt: null },
          include: { chunks: true },
        },
      },
    });
    if (!kb) throw new NotFoundException("Knowledge base not found");

    const queryVector = await this.embed(body.query.trim(), kb.embeddingModel);
    const topK = Math.min(Math.max(body.topK ?? 3, 1), 10);

    const results: SearchResult[] = [];
    for (const doc of kb.documents) {
      for (const chunk of doc.chunks) {
        const vector = chunk.embedding as number[];
        results.push({
          documentId: doc.id,
          filename: doc.filename,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: cosineSimilarity(queryVector, vector),
        });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}
