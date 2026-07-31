import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ExecutionsService } from "./executions.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../auth/auth.types";

@Controller("executions")
@UseGuards(JwtAuthGuard)
export class ExecutionsController {
  constructor(private readonly executions: ExecutionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("workflowId") workflowId?: string) {
    return this.executions.list(user.organizationId, workflowId);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.executions.get(user.organizationId, id);
  }
}
