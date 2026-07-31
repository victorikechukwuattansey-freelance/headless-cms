import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from "@nestjs/common";
import { RagService } from "./rag.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../auth/auth.types";

@Controller("knowledge-bases")
@UseGuards(JwtAuthGuard)
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.rag.list(user.organizationId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.rag.get(user.organizationId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; description?: string; chunkSize?: number; chunkOverlap?: number; embeddingModel?: string },
  ) {
    return this.rag.create(user.organizationId, user.userId, body);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.rag.remove(user.organizationId, id);
  }

  @Post(":id/documents")
  addDocument(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { filename: string; content: string },
  ) {
    return this.rag.addDocument(user.organizationId, id, body);
  }

  @Get(":id/search")
  search(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("q") q: string,
    @Query("topK") topK?: string,
  ) {
    return this.rag.search(user.organizationId, id, { query: q ?? "", topK: topK ? Number(topK) : undefined });
  }
}
