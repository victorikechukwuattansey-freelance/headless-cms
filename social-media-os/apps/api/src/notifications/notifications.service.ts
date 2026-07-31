import { Injectable, Logger } from '@nestjs/common';

interface EmailNotification {
  to: string;
  subject: string;
  body: string;
}

interface SlackNotification {
  webhookUrl: string;
  message: string;
  channel?: string;
}

interface WebhookNotification {
  url: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendEmail(notification: EmailNotification) {
    this.logger.log(`Email notification to ${notification.to}: ${notification.subject}`);

    if (!process.env.SMTP_HOST) {
      this.logger.warn('SMTP not configured, logging email notification');
      return {
        sent: false,
        message: 'Email service not configured',
        notification,
      };
    }

    try {
      const response = await fetch(`${process.env.SMTP_HOST || 'http://localhost'}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: notification.to,
          subject: notification.subject,
          text: notification.body,
        }),
      });

      return { sent: response.ok, id: response.ok ? await response.text() : null };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error}`);
      return { sent: false, error: 'Email delivery failed' };
    }
  }

  async sendSlack(notification: SlackNotification) {
    this.logger.log(`Slack notification: ${notification.message.substring(0, 100)}...`);

    try {
      const response = await fetch(notification.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: notification.message,
          channel: notification.channel,
        }),
      });

      return { sent: response.ok, statusCode: response.status };
    } catch (error) {
      this.logger.error(`Failed to send Slack notification: ${error}`);
      return { sent: false, error: 'Slack delivery failed' };
    }
  }

  async sendWebhook(notification: WebhookNotification) {
    this.logger.log(`Webhook notification to ${notification.url}`);

    try {
      const response = await fetch(notification.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(notification.headers || {}),
        },
        body: JSON.stringify(notification.payload),
      });

      return { sent: response.ok, statusCode: response.status };
    } catch (error) {
      this.logger.error(`Failed to send webhook: ${error}`);
      return { sent: false, error: 'Webhook delivery failed' };
    }
  }

  async notifyPostPublished(data: {
    workspaceId: string;
    postId: string;
    platform: string;
    userEmail: string;
  }) {
    return this.sendEmail({
      to: data.userEmail,
      subject: `Post Published on ${data.platform}`,
      body: `Your post has been successfully published on ${data.platform}.\n\nPost ID: ${data.postId}\n\nView it in the dashboard for performance analytics.`,
    });
  }

  async notifyPostFailed(data: {
    workspaceId: string;
    postId: string;
    platform: string;
    error: string;
    userEmail: string;
  }) {
    return this.sendEmail({
      to: data.userEmail,
      subject: `Post Failed on ${data.platform}`,
      body: `Your post failed to publish on ${data.platform}.\n\nPost ID: ${data.postId}\nError: ${data.error}\n\nPlease check your account connection and try again.`,
    });
  }

  async notifyScheduledPost(data: {
    workspaceId: string;
    postId: string;
    scheduledAt: Date;
    userEmail: string;
  }) {
    return this.sendEmail({
      to: data.userEmail,
      subject: 'Post Scheduled',
      body: `Your post has been scheduled for ${data.scheduledAt.toLocaleString()}.\n\nPost ID: ${data.postId}`,
    });
  }
}
