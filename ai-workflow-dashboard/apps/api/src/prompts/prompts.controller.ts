import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { PromptsService } from "./prompts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../auth/auth.types";

@Controller("prompts")
@UseGuards(JwtAuthGuard)
export class PromptsController {
  constructor(private readonly prompts: PromptsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.prompts.list(user.organizationId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.prompts.get(user.organizationId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { title: string; content: string; tags?: string[] },
  ) {
    return this.prompts.create(user.organizationId, user.userId, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { title?: string; content?: string; tags?: string[] },
  ) {
    return this.prompts.update(user.organizationId, id, body);
  }

  @Post(":id/publish")
  publish(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.prompts.publish(user.organizationId, id);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.prompts.remove(user.organizationId, id);
  }
}
