import { Injectable } from '@nestjs/common';
import { BasePlatformAdapter, PlatformPostResult, PlatformProfile } from './base.adapter';

@Injectable()
export class LinkedInAdapter extends BasePlatformAdapter {
  private readonly baseUrl = 'https://api.linkedin.com/v2';

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      redirect_uri: redirectUri,
      state,
      scope: 'w_member_social r_liteprofile r_emailaddress',
      response_type: 'code',
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string) {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
    });

    const response = await this.makeRequest('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: undefined,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    };
  }

  async refreshToken(refreshToken: string) {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
    });

    const response = await this.makeRequest('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
    const author = `urn:li:person:${this.config.accountId}`;

    const postBody: Record<string, unknown> = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: mediaUrls.length > 0 ? 'IMAGE' : 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    if (mediaUrls.length > 0) {
      const media = mediaUrls.map((url) => ({
        status: 'READY',
        description: { text: '' },
        media: url,
        title: { text: '' },
      }));
      (postBody.specificContent as any)['com.linkedin.ugc.ShareContent'].media = media;
    }

    const response = await this.makeRequest(`${this.baseUrl}/ugc/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postBody),
    });

    const location = response.headers.get('x-restli-id') || '';
    return {
      platformPostId: location,
      platformPostUrl: `https://linkedin.com/feed/update/${location}`,
      publishedAt: new Date(),
    };
  }

  async getProfile(): Promise<PlatformProfile> {
    const response = await this.makeRequest(`${this.baseUrl}/me`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    const data = await response.json();

    const emailResponse = await this.makeRequest(`${this.baseUrl}/emailAddress?q=members&projection=(elements*(handle~))`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    const emailData = await emailResponse.json();

    return {
      accountId: data.id,
      accountName: `${data.localizedFirstName} ${data.localizedLastName}`,
      avatarUrl: data.profilePicture?.['displayImage~']?.elements?.[0]?.identifiers?.[0]?.identifier,
    };
  }
}
