import { Injectable } from '@nestjs/common';
import { BasePlatformAdapter, PlatformPostResult, PlatformProfile } from './base.adapter';

@Injectable()
export class TwitterAdapter extends BasePlatformAdapter {
  private readonly baseUrl = 'https://api.twitter.com/2';

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.TWITTER_CLIENT_ID || '',
      redirect_uri: redirectUri,
      state,
      scope: 'tweet.read tweet.write users.read offline.access',
      response_type: 'code',
      code_challenge: 'challenge',
      code_challenge_method: 'plain',
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string) {
    const basicAuth = Buffer.from(
      `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`,
    ).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: 'challenge',
    });

    const response = await this.makeRequest('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async refreshToken(refreshToken: string) {
    const basicAuth = Buffer.from(
      `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`,
    ).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await this.makeRequest('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async post(content: string, mediaUrls: string[]): Promise<PlatformPostResult> {
    const tweet: Record<string, unknown> = { text: content };

    if (mediaUrls.length > 0) {
      const mediaIds = await Promise.all(
        mediaUrls.map((url) => this.uploadMedia(url)),
      );
      tweet.media = { media_ids: mediaIds };
    }

    const response = await this.makeRequest(`${this.baseUrl}/tweets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
      body: JSON.stringify(tweet),
    });

    const data = await response.json();
    return {
      platformPostId: data.data?.id,
      platformPostUrl: `https://twitter.com/i/web/status/${data.data?.id}`,
      publishedAt: new Date(),
    };
  }

  private async uploadMedia(url: string): Promise<string> {
    const mediaResponse = await fetch(url);
    const mediaBuffer = await mediaResponse.arrayBuffer();
    const base64Media = Buffer.from(mediaBuffer).toString('base64');

    const uploadResponse = await this.makeRequest(
      'https://upload.twitter.com/1.1/media/upload.json',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
        body: new URLSearchParams({ media_data: base64Media }).toString(),
      },
    );

    const mediaData = await uploadResponse.json();
    return mediaData.media_id_string;
  }

  async getProfile(): Promise<PlatformProfile> {
    const response = await this.makeRequest(`${this.baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    const data = await response.json();
    return {
      accountId: data.data?.id,
      accountName: data.data?.username || 'Unknown',
      avatarUrl: data.data?.profile_image_url,
    };
  }
}
