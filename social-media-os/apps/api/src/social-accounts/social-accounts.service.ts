import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Platform } from '@prisma/client';
import { FacebookAdapter } from './platforms/facebook.adapter';
import { InstagramAdapter } from './platforms/instagram.adapter';
import { TwitterAdapter } from './platforms/twitter.adapter';
import { LinkedInAdapter } from './platforms/linkedin.adapter';
import { TikTokAdapter } from './platforms/tiktok.adapter';

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  private readonly adapters: Record<string, FacebookAdapter | InstagramAdapter | TwitterAdapter | LinkedInAdapter | TikTokAdapter> = {};

  constructor(
    private prisma: PrismaService,
    private facebookAdapter: FacebookAdapter,
    private instagramAdapter: InstagramAdapter,
    private twitterAdapter: TwitterAdapter,
    private linkedinAdapter: LinkedInAdapter,
    private tiktokAdapter: TikTokAdapter,
  ) {}

  private getAdapter(platform: string) {
    switch (platform) {
      case 'FACEBOOK': return this.facebookAdapter;
      case 'INSTAGRAM': return this.instagramAdapter;
      case 'TWITTER': return this.twitterAdapter;
      case 'LINKEDIN': return this.linkedinAdapter;
      case 'TIKTOK': return this.tiktokAdapter;
      default:
        throw new Error(`No adapter implemented for platform: ${platform}`);
    }
  }

  async connect(workspaceId: string, platform: string, code: string, redirectUri: string) {
    const adapter = this.getAdapter(platform);
    const tokenData = await adapter.exchangeCode(code, redirectUri);
    adapter.setConfig({
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt: tokenData.expiresAt,
    });

    const profile = await adapter.getProfile();

    const existing = await this.prisma.socialAccount.findUnique({
      where: { workspaceId_platform_accountId: { workspaceId, platform: platform as Platform, accountId: profile.accountId } },
    });

    if (existing) {
      return this.prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          tokenExpiresAt: tokenData.expiresAt,
          isActive: true,
          accountName: profile.accountName,
          avatarUrl: profile.avatarUrl,
        },
      });
    }

    const account = await this.prisma.socialAccount.create({
      data: {
        workspaceId,
        platform: platform as Platform,
        accountName: profile.accountName,
        accountId: profile.accountId,
        avatarUrl: profile.avatarUrl,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        tokenExpiresAt: tokenData.expiresAt,
      },
    });

    this.logger.log(`Social account connected: ${profile.accountName} (${platform})`);

    return account;
  }

  async disconnect(id: string) {
    const account = await this.prisma.socialAccount.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException('Social account not found');
    }

    await this.prisma.socialAccount.update({
      where: { id },
      data: { isActive: false, accessToken: '', refreshToken: null },
    });

    this.logger.log(`Social account disconnected: ${account.accountName}`);
    return { message: 'Account disconnected successfully' };
  }

  async refreshToken(id: string) {
    const account = await this.prisma.socialAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Social account not found');
    if (!account.refreshToken) throw new Error('No refresh token available');

    const adapter = this.getAdapter(account.platform);
    const tokenData = await adapter.refreshToken(account.refreshToken);

    return this.prisma.socialAccount.update({
      where: { id },
      data: {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        tokenExpiresAt: tokenData.expiresAt,
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.socialAccount.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const account = await this.prisma.socialAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Social account not found');
    return account;
  }

  async getStatus(id: string) {
    const account = await this.findById(id);
    const isExpired = account.tokenExpiresAt ? new Date() > account.tokenExpiresAt : false;
    return {
      id: account.id,
      platform: account.platform,
      accountName: account.accountName,
      isActive: account.isActive,
      isExpired,
      tokenExpiresAt: account.tokenExpiresAt,
    };
  }

  async getAuthUrl(platform: string, redirectUri: string): Promise<string> {
    const adapter = this.getAdapter(platform);
    return adapter.getAuthUrl(redirectUri, Math.random().toString(36).substring(2));
  }
}
