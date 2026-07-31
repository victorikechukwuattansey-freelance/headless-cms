import { Injectable } from '@nestjs/common';
import { BasePlatformAdapter, PlatformPostResult, PlatformProfile } from './base.adapter';

@Injectable()
export class TikTokAdapter extends BasePlatformAdapter {
  private readonly baseUrl = 'https://open-api.tiktok.com';

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY || '',
      redirect_uri: redirectUri,
      state,
      scope: 'user.info.basic,video.publish,data.insights',
      response_type: 'code',
    });
    return `https://www.tiktok.com/v2/auth/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string) {
    const params = {
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };

    const response = await this.makeRequest(`${this.baseUrl}/oauth/access_token/`, {
      method: 'POST',
      body: JSON.stringify(params),
    });

    const data = await response.json();
    const tokenData = data.data;
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    };
  }

  async refreshToken(refreshToken: string) {
    const params = {
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    };

    const response = await this.makeRequest(`${this.baseUrl}/oauth/refresh_token/`, {
      method: 'POST',
      body: JSON.stringify(params),
    });

    const data = await response.json();
    const tokenData = data.data;
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    };
  }

  async post(content: string, mediaUrls: string[]): Promise<PlatformPostResult> {
    if (mediaUrls.length === 0) {
      throw new Error('TikTok requires a video for posting');
    }

    const videoUrl = mediaUrls[0];
    const initResponse = await this.makeRequest(`${this.baseUrl}/video/init/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
      body: JSON.stringify({
        source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
        post_info: {
          privacy_level: 'PUBLIC',
          title: content,
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
        },
      }),
    });

    const initData = await initResponse.json();
    const publishId = initData.data?.publish_id;

    let status = 'processing';
    let attempts = 0;
    while (status === 'processing' && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusResponse = await this.makeRequest(
        `${this.baseUrl}/video/status/?publish_id=${publishId}`,
        { headers: { Authorization: `Bearer ${this.config.accessToken}` } },
      );
      const statusData = await statusResponse.json();
      status = statusData.data?.status;
      attempts++;
    }

    if (status !== 'PUBLISHED') {
      throw new Error(`TikTok publish failed with status: ${status}`);
    }

    return {
      platformPostId: publishId,
      platformPostUrl: `https://tiktok.com/@${this.config.accountId}/video/${publishId}`,
      publishedAt: new Date(),
    };
  }

  async getProfile(): Promise<PlatformProfile> {
    const response = await this.makeRequest(`${this.baseUrl}/user/info/`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    const data = await response.json();
    const user = data.data?.user;
    return {
      accountId: user?.open_id || '',
      accountName: user?.display_name || user?.username || 'Unknown',
      avatarUrl: user?.avatar_url,
      followerCount: user?.follower_count,
    };
  }
}
