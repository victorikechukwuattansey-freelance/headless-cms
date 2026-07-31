import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule, type JwtModuleOptions } from "@nestjs/jwt";
import { HealthController } from "./health/health.controller";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { WorkflowsController } from "./workflows/workflows.controller";
import { WorkflowsService } from "./workflows/workflows.service";
import { ExecutionsController } from "./executions/executions.controller";
import { ExecutionsService } from "./executions/executions.service";
import { WebhooksController } from "./webhooks/webhooks.controller";
import { WebhooksService } from "./webhooks/webhooks.service";
import { CredentialsController } from "./credentials/credentials.controller";
import { CredentialsService } from "./credentials/credentials.service";
import { PromptsController } from "./prompts/prompts.controller";
import { PromptsService } from "./prompts/prompts.service";
import { RagController } from "./rag/rag.controller";
import { RagService } from "./rag/rag.service";
import { AnalyticsController } from "./analytics/analytics.controller";
import { AnalyticsService } from "./analytics/analytics.service";
import { MetricsController } from "./metrics/metrics.controller";
import { QueueService } from "./queue/queue.service";
import { AiService } from "./ai/ai.service";
import { loadEnv } from "@awd/config";

const env = loadEnv();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: env.JWT_EXPIRES_IN ?? "7d" } as JwtModuleOptions["signOptions"],
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    WorkflowsController,
    ExecutionsController,
    WebhooksController,
    CredentialsController,
    PromptsController,
    RagController,
    AnalyticsController,
    MetricsController,
  ],
  providers: [AuthService, WorkflowsService, ExecutionsService, WebhooksService, QueueService, AiService, CredentialsService, PromptsService, RagService, AnalyticsService],
})
export class AppModule {}
