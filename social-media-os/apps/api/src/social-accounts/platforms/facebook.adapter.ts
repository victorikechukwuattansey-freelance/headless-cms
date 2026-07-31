import { Injectable } from '@nestjs/common';
import { BasePlatformAdapter, PlatformPostResult, PlatformProfile } from './base.adapter';

@Injectable()
export class FacebookAdapter extends BasePlatformAdapter {
  private readonly baseUrl = 'https://graph.facebook.com/v19.0';

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID || '',
      redirect_uri: redirectUri,
      state,
      scope: 'pages_manage_posts,pages_read_engagement,pages_show_list',
      response_type: 'code',
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string) {
    const url = `${this.baseUrl}/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID || '',
      client_secret: process.env.FACEBOOK_APP_SECRET || '',
      redirect_uri: redirectUri,
      code,
    });

    const response = await this.makeRequest(`${url}?${params}`);
    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: undefined,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async refreshToken(refreshToken: string) {
    const url = `${this.baseUrl}/oauth/access_token`;
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.FACEBOOK_APP_ID || '',
      client_secret: process.env.FACEBOOK_APP_SECRET || '',
      fb_exchange_token: refreshToken,
    });

    const response = await this.makeRequest(`${url}?${params}`);
    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: undefined,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async post(content: string, mediaUrls: string[]): Promise<PlatformPostResult> {
    const pageId = this.config.accountId;
    if (!pageId) throw new Error('Facebook Page ID is required');

    const message: Record<string, unknown> = { message: content };
    if (mediaUrls.length > 0) {
      message.attached_media = mediaUrls.map((url) => ({
        media_fbid: url,
      }));
    }

    const response = await this.makeRequest(
      `${this.baseUrl}/${pageId}/feed?access_token=${this.config.accessToken}`,
      {
        method: 'POST',
        body: JSON.stringify(message),
      },
    );
    const data = await response.json();
    return {
      platformPostId: data.id,
      platformPostUrl: `https://facebook.com/${data.id}`,
      publishedAt: new Date(),
    };
  }

  async getProfile(): Promise<PlatformProfile> {
    const response = await this.makeRequest(
      `${this.baseUrl}/me/accounts?access_token=${this.config.accessToken}`,
    );
    const data = await response.json();
    const page = data.data?.[0];
    return {
      accountId: page?.id || '',
      accountName: page?.name || 'Unknown',
      avatarUrl: undefined,
      followerCount: page?.fan_count,
    };
  }
}
