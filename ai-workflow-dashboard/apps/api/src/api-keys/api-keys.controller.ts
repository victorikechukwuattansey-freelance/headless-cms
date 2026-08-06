import { Controller, Get, Post, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { ApiKeysService } from "./api-keys.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../auth/auth.types";

@Controller("api-keys")
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.apiKeys.list(user.organizationId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { name: string; expiresAt?: string | null }) {
    return this.apiKeys.create(user.organizationId, user.userId, body);
  }

  @Delete(":id")
  revoke(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.apiKeys.revoke(user.organizationId, id);
  }
}
