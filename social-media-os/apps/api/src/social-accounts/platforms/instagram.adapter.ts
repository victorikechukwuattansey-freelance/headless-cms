import { Injectable } from '@nestjs/common';
import { BasePlatformAdapter, PlatformPostResult, PlatformProfile } from './base.adapter';

@Injectable()
export class InstagramAdapter extends BasePlatformAdapter {
  private readonly baseUrl = 'https://graph.facebook.com/v19.0';

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID || '',
      redirect_uri: redirectUri,
      state,
      scope: 'instagram_basic,instagram_content_publish,instagram_graph_user_profile',
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
    const igUserId = this.config.accountId;
    if (!igUserId) throw new Error('Instagram Business Account ID is required');

    if (mediaUrls.length === 0) {
      const creationResponse = await this.makeRequest(
        `${this.baseUrl}/${igUserId}/media?access_token=${this.config.accessToken}`,
        {
          method: 'POST',
          body: JSON.stringify({
            caption: content,
            media_type: 'IMAGE',
            image_url: content.match(/https?:\/\/[^\s]+/)?.[0] || '',
          }),
        },
      );
      const creation = await creationResponse.json();

      const publishResponse = await this.makeRequest(
        `${this.baseUrl}/${igUserId}/media_publish?access_token=${this.config.accessToken}`,
        {
          method: 'POST',
          body: JSON.stringify({ creation_id: creation.id }),
        },
      );
      const publish = await publishResponse.json();
      return {
        platformPostId: publish.id,
        platformPostUrl: `https://instagram.com/p/${publish.id}/`,
        publishedAt: new Date(),
      };
    }

    const creationResponse = await this.makeRequest(
      `${this.baseUrl}/${igUserId}/media?access_token=${this.config.accessToken}`,
      {
        method: 'POST',
        body: JSON.stringify({
          caption: content,
          media_type: mediaUrls.length > 1 ? 'CAROUSEL' : 'IMAGE',
          image_url: mediaUrls[0],
          children: mediaUrls.length > 1 ? mediaUrls.map((url, i) => ({
            media_type: 'IMAGE',
            image_url: url,
            is_carousel_item: true,
          })) : undefined,
        }),
      },
    );
    const creation = await creationResponse.json();

    const publishResponse = await this.makeRequest(
      `${this.baseUrl}/${igUserId}/media_publish?access_token=${this.config.accessToken}`,
      {
        method: 'POST',
        body: JSON.stringify({ creation_id: creation.id }),
      },
    );
    const publish = await publishResponse.json();
    return {
      platformPostId: publish.id,
      platformPostUrl: `https://instagram.com/p/${publish.id}/`,
      publishedAt: new Date(),
    };
  }

  async getProfile(): Promise<PlatformProfile> {
    const response = await this.makeRequest(
      `${this.baseUrl}/me/accounts?access_token=${this.config.accessToken}&fields=instagram_business_account{id,username,profile_picture_url,followers_count}`,
    );
    const data = await response.json();
    const page = data.data?.[0];
    const ig = page?.instagram_business_account;
    return {
      accountId: ig?.id || '',
      accountName: ig?.username || 'Unknown',
      avatarUrl: ig?.profile_picture_url,
      followerCount: ig?.followers_count,
    };
  }
}
