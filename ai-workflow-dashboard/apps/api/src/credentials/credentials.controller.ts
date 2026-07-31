import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { CredentialsService } from "./credentials.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../auth/auth.types";

@Controller("credentials")
@UseGuards(JwtAuthGuard)
export class CredentialsController {
  constructor(private readonly credentials: CredentialsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.credentials.list(user.organizationId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.credentials.get(user.organizationId, id);
  }

  @Get(":id/secret")
  getSecret(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.credentials.getSecret(user.organizationId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; provider: string; secret: string; expiresAt?: string },
  ) {
    return this.credentials.create(user.organizationId, user.userId, body);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { name?: string; provider?: string; secret?: string; status?: string; expiresAt?: string | null },
  ) {
    return this.credentials.update(user.organizationId, id, body);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.credentials.remove(user.organizationId, id);
  }
}
