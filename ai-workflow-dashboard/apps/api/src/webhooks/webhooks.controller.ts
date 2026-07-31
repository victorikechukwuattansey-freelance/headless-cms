import { Body, Controller, Post, Param, UseGuards } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Public } from "../auth/auth.types";

@Controller("webhooks")
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Public()
  @Post(":token")
  handle(@Param("token") token: string, @Body() body: unknown) {
    return this.webhooks.handle(token, body);
  }
}
