import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { SocialAccountsModule } from './social-accounts/social-accounts.module';
import { PostsModule } from './posts/posts.module';
import { PublishingModule } from './publishing/publishing.module';
import { AiModule } from './ai/ai.module';
import { BrandVoicesModule } from './brand-voices/brand-voices.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { McpModule } from './mcp/mcp.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { EngagementModule } from './engagement/engagement.module';
import { BillingModule } from './billing/billing.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    WorkspacesModule,
    SocialAccountsModule,
    PostsModule,
    PublishingModule,
    AiModule,
    BrandVoicesModule,
    AnalyticsModule,
    WorkflowsModule,
    McpModule,
    CampaignsModule,
    EngagementModule,
    BillingModule,
    NotificationsModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
