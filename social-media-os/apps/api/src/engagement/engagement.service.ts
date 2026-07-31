import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(private prisma: PrismaService) {}

  async getComments(workspaceId: string, platform?: string, postId?: string) {
    const where: Record<string, unknown> = { workspaceId };
    if (platform) where.platform = platform;
    if (postId) where.postId = postId;

    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        workspaceId,
        eventType: 'engagement_received',
        ...(platform ? { platform: platform as any } : {}),
        ...(postId ? { postId } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    return events.map((event) => ({
      id: event.id,
      platform: event.platform,
      postId: event.postId,
      type: event.eventType,
      metadata: event.metadata as Record<string, unknown> | null,
      timestamp: event.timestamp,
    }));
  }

  async replyToComment(data: {
    workspaceId: string;
    platform: string;
    postId: string;
    commentId: string;
    replyText: string;
  }) {
    const socialAccount = await this.prisma.socialAccount.findFirst({
      where: {
        workspaceId: data.workspaceId,
        platform: data.platform as any,
        isActive: true,
      },
    });

    if (!socialAccount) {
      throw new Error(`No active ${data.platform} account found`);
    }

    const platform = data.platform.toLowerCase();

    try {
      let response: Response;

      switch (platform) {
        case 'facebook': {
          response = await fetch(
            `https://graph.facebook.com/v19.0/${data.commentId}/comments?access_token=${socialAccount.accessToken}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: data.replyText }),
            },
          );
          break;
        }
        case 'instagram': {
          response = await fetch(
            `https://graph.facebook.com/v19.0/${data.commentId}/replies?access_token=${socialAccount.accessToken}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: data.replyText }),
            },
          );
          break;
        }
        case 'linkedin': {
          response = await fetch(
            `https://api.linkedin.com/v2/socialActions/${data.commentId}/comments`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${socialAccount.accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
              },
              body: JSON.stringify({ comment: data.replyText }),
            },
          );
          break;
        }
        default:
          throw new Error(`Reply not implemented for platform: ${platform}`);
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to reply: ${error}`);
      }

      const result = await response.json();

      this.logger.log(`Replied to comment ${data.commentId} on ${data.platform}`);

      return { success: true, replyId: result.id || result, platform: data.platform };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reply failed';
      this.logger.error(`Failed to reply to comment: ${message}`);
      throw new Error(`Failed to post reply: ${message}`);
    }
  }

  async analyzeSentiment(comments: string[]): Promise<Array<{ text: string; sentiment: 'positive' | 'negative' | 'neutral'; score: number }>> {
    const results = comments.map((text) => {
      const positiveWords = ['great', 'awesome', 'love', 'amazing', 'excellent', 'good', 'fantastic', 'thank'];
      const negativeWords = ['bad', 'awful', 'terrible', 'hate', 'worst', 'poor', 'horrible'];

      const lower = text.toLowerCase();
      let score = 0;

      for (const word of positiveWords) {
        if (lower.includes(word)) score += 1;
      }
      for (const word of negativeWords) {
        if (lower.includes(word)) score -= 1;
      }

      let sentiment: 'positive' | 'negative' | 'neutral';
      if (score > 0) sentiment = 'positive';
      else if (score < 0) sentiment = 'negative';
      else sentiment = 'neutral';

      return { text, sentiment, score };
    });

    return results;
  }

  async getPriorityScore(comment: string): Promise<number> {
    const urgentWords = ['urgent', 'asap', 'emergency', 'critical', 'important', 'help', 'issue', 'problem', 'bug', 'broken'];
    const lower = comment.toLowerCase();
    let score = 0;

    for (const word of urgentWords) {
      if (lower.includes(word)) score += 20;
    }

    const length = comment.length;
    if (length > 200) score += 10;
    if (length > 100) score += 5;

    return Math.min(score, 100);
  }

  async draftReply(comment: string, brandVoiceId?: string): Promise<string> {
    const commentWords = comment.split(' ').slice(0, 20).join(' ');
    const reply = `Thank you for your feedback regarding "${commentWords.substring(0, 50)}..."`;

    return reply;
  }
}
