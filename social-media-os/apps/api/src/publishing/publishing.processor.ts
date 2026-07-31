import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookAdapter } from '../social-accounts/platforms/facebook.adapter';
import { InstagramAdapter } from '../social-accounts/platforms/instagram.adapter';
import { TwitterAdapter } from '../social-accounts/platforms/twitter.adapter';
import { LinkedInAdapter } from '../social-accounts/platforms/linkedin.adapter';
import { TikTokAdapter } from '../social-accounts/platforms/tiktok.adapter';

@Injectable()
export class PublishingProcessor {
  private readonly logger = new Logger(PublishingProcessor.name);
  private worker: Worker;

  constructor(
    private prisma: PrismaService,
    private facebookAdapter: FacebookAdapter,
    private instagramAdapter: InstagramAdapter,
    private twitterAdapter: TwitterAdapter,
    private linkedinAdapter: LinkedInAdapter,
    private tiktokAdapter: TikTokAdapter,
  ) {
    const connection = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker(
      'social-posts',
      async (job: Job) => this.process(job),
      {
        connection,
        concurrency: 5,
        maxStalledCount: 3,
        stalledInterval: 30000,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed: ${error.message}`, error.stack);
    });

    this.logger.log('Publishing processor initialized');
  }

  private getAdapter(platform: string) {
    switch (platform) {
      case 'FACEBOOK': return this.facebookAdapter;
      case 'INSTAGRAM': return this.instagramAdapter;
      case 'TWITTER': return this.twitterAdapter;
      case 'LINKEDIN': return this.linkedinAdapter;
      case 'TIKTOK': return this.tiktokAdapter;
      default:
        throw new Error(`No adapter for platform: ${platform}`);
    }
  }

  async process(job: Job<{ postId: string }>) {
    const { postId } = job.data;
    this.logger.log(`Processing publish job for post ${postId}`);

    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { versions: true },
    });

    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    if (post.status === 'CANCELLED') {
      this.logger.log(`Post ${postId} was cancelled, skipping`);
      return { skipped: true, reason: 'cancelled' };
    }

    if (post.status === 'PUBLISHED') {
      this.logger.log(`Post ${postId} already published, skipping`);
      return { skipped: true, reason: 'already_published' };
    }

    const results = [];

    for (const version of post.versions) {
      try {
        const socialAccounts = await this.prisma.socialAccount.findFirst({
          where: {
            workspaceId: post.workspaceId,
            platform: version.platform,
            isActive: true,
          },
        });

        if (!socialAccounts) {
          throw new Error(`No active social account found for ${version.platform}`);
        }

        const adapter = this.getAdapter(version.platform);
        adapter.setConfig({
          accessToken: socialAccounts.accessToken,
          refreshToken: socialAccounts.refreshToken || undefined,
          tokenExpiresAt: socialAccounts.tokenExpiresAt || undefined,
          accountId: socialAccounts.accountId,
        });

        const result = await adapter.post(version.content, version.mediaUrls);

        await this.prisma.postVersion.update({
          where: { id: version.id },
          data: {
            status: 'PUBLISHED',
            platformPostId: result.platformPostId,
            platformPostUrl: result.platformPostUrl,
            publishedAt: result.publishedAt,
          },
        });

        results.push({
          platform: version.platform,
          success: true,
          platformPostId: result.platformPostId,
        });

        await this.prisma.analyticsEvent.create({
          data: {
            workspaceId: post.workspaceId,
            platform: version.platform,
            eventType: 'post_published',
            postId: post.id,
            metadata: { platformPostId: result.platformPostId },
          },
        });

        this.logger.log(`Published to ${version.platform}: ${result.platformPostId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to publish to ${version.platform}: ${message}`);

        await this.prisma.postVersion.update({
          where: { id: version.id },
          data: {
            status: 'FAILED',
            errorMessage: message,
          },
        });

        await this.prisma.analyticsEvent.create({
          data: {
            workspaceId: post.workspaceId,
            platform: version.platform,
            eventType: 'post_failed',
            postId: post.id,
            metadata: { error: message },
          },
        });

        results.push({
          platform: version.platform,
          success: false,
          error: message,
        });
      }
    }

    const allPublished = results.every((r) => r.success);
    const anyPublished = results.some((r) => r.success);

    await this.prisma.post.update({
      where: { id: post.id },
      data: {
        status: allPublished ? 'PUBLISHED' : anyPublished ? 'PUBLISHED' : 'FAILED',
        publishedAt: anyPublished ? new Date() : null,
      },
    });

    this.logger.log(`Post ${postId} processing complete`);

    return { postId, results };
  }
}
