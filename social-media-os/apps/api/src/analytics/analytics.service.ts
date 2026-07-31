import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async ingestEvent(data: {
    workspaceId: string;
    platform: string;
    eventType: string;
    postId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.analyticsEvent.create({
      data: {
        workspaceId: data.workspaceId,
        platform: data.platform as any,
        eventType: data.eventType,
        postId: data.postId || null,
        metadata: data.metadata || undefined,
      },
    });
  }

  async getOverview(workspaceId: string, startDate: Date, endDate: Date) {
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        workspaceId,
        timestamp: { gte: startDate, lte: endDate },
      },
      orderBy: { timestamp: 'desc' },
    });

    const totalEvents = events.length;
    const byPlatform = this.groupBy(events, 'platform');
    const byEventType = this.groupBy(events, 'eventType');

    const platformSummary = Object.entries(byPlatform).map(([platform, evts]) => ({
      platform,
      total: evts.length,
      byType: this.groupBy(evts, 'eventType'),
    }));

    const postsPublished = events.filter((e) => e.eventType === 'post_published').length;
    const postsFailed = events.filter((e) => e.eventType === 'post_failed').length;
    const aiGenerations = events.filter((e) => e.eventType === 'ai_generation').length;
    const engagements = events.filter((e) => e.eventType === 'engagement_received').length;

    return {
      totalEvents,
      dateRange: { startDate, endDate },
      summary: {
        postsPublished,
        postsFailed,
        aiGenerations,
        engagements,
      },
      byPlatform: platformSummary,
      totalByType: Object.entries(byEventType).map(([type, evts]) => ({
        eventType: type,
        count: evts.length,
      })),
    };
  }

  async getPlatformMetrics(workspaceId: string, platform: string, startDate: Date, endDate: Date) {
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        workspaceId,
        platform: platform as any,
        timestamp: { gte: startDate, lte: endDate },
      },
      orderBy: { timestamp: 'desc' },
    });

    const byType = this.groupBy(events, 'eventType');
    const byDay = this.groupByDate(events);

    return {
      platform,
      totalEvents: events.length,
      byType: Object.entries(byType).map(([type, evts]) => ({ eventType: type, count: evts.length })),
      byDay: Object.entries(byDay).map(([date, evts]) => ({
        date,
        count: evts.length,
        byType: this.groupBy(evts, 'eventType'),
      })),
    };
  }

  async getInsights(workspaceId: string) {
    const totalPosts = await this.prisma.post.count({
      where: { workspaceId },
    });

    const publishedPosts = await this.prisma.post.count({
      where: { workspaceId, status: 'PUBLISHED' },
    });

    const failedPosts = await this.prisma.post.count({
      where: { workspaceId, status: 'FAILED' },
    });

    const scheduledPosts = await this.prisma.post.count({
      where: { workspaceId, status: 'SCHEDULED' },
    });

    const totalAiGenerations = await this.prisma.aIGeneration.count({
      where: { workspaceId },
    });

    const accountsConnected = await this.prisma.socialAccount.count({
      where: { workspaceId, isActive: true },
    });

    const recentEvents = await this.prisma.analyticsEvent.findMany({
      where: { workspaceId },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    const eventsByPlatform = this.groupBy(recentEvents, 'platform');
    const bestPlatform = Object.entries(eventsByPlatform)
      .sort(([, a], [, b]) => b.length - a.length)
      .shift();

    return {
      overview: {
        totalPosts,
        publishedPosts,
        failedPosts,
        scheduledPosts,
        totalAiGenerations,
        accountsConnected,
      },
      bestPerformingPlatform: bestPlatform?.[0] || null,
      recommendations: [
        failedPosts > 0 ? `${failedPosts} posts failed — review error logs and reconnect accounts if needed.` : null,
        scheduledPosts > 0 ? `${scheduledPosts} posts scheduled for publication.` : null,
        !bestPlatform ? 'Connect a social account to start publishing.' : null,
      ].filter(Boolean),
    };
  }

  private groupBy<T extends Record<string, unknown>>(items: T[], key: string): Record<string, T[]> {
    return items.reduce(
      (acc, item) => {
        const k = String(item[key]);
        if (!acc[k]) acc[k] = [];
        acc[k].push(item);
        return acc;
      },
      {} as Record<string, T[]>,
    );
  }

  private groupByDate<T extends { timestamp: Date }>(items: T[]): Record<string, T[]> {
    return items.reduce(
      (acc, item) => {
        const date = item.timestamp.toISOString().split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(item);
        return acc;
      },
      {} as Record<string, T[]>,
    );
  }
}
