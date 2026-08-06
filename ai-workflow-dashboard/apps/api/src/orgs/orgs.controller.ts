import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { OrgsService } from "./orgs.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../auth/auth.types";

@Controller("orgs")
@UseGuards(JwtAuthGuard)
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orgs.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { name: string }) {
    return this.orgs.create(user.userId, body);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.orgs.get(id, user.userId);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: { name?: string }) {
    return this.orgs.update(id, user.userId, body);
  }

  @Get(":id/members")
  members(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.orgs.members(id, user.userId);
  }

  @Post(":id/members")
  invite(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: { email: string; role?: string }) {
    return this.orgs.invite(id, user.userId, body);
  }

  @Patch(":id/members/:userId")
  updateRole(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Body() body: { role: string },
  ) {
    return this.orgs.updateRole(id, user.userId, userId, body);
  }

  @Delete(":id/members/:userId")
  removeMember(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("userId") userId: string) {
    return this.orgs.removeMember(id, user.userId, userId);
  }
}
