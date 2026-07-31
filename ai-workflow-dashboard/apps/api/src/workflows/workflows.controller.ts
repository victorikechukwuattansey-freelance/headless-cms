import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { WorkflowsService, GraphPayload } from "./workflows.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../auth/auth.types";

@Controller("workflows")
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.workflows.list(user.organizationId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.workflows.get(user.organizationId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; description?: string; graph: import("./workflows.service").GraphPayload },
  ) {
    return this.workflows.create(user.organizationId, user.userId, body);
  }

  @Post(":id/publish")
  publish(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.workflows.publish(user.organizationId, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { name?: string; description?: string; scheduleCron?: string | null; graph: GraphPayload },
  ) {
    return this.workflows.update(user.organizationId, id, user.userId, body);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.workflows.remove(user.organizationId, id);
  }

  @Post(":id/run")
  run(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: Record<string, unknown> = {}) {
    return this.workflows.run(user.organizationId, id, body);
  }
}
