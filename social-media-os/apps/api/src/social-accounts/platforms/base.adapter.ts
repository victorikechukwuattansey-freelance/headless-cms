export interface PlatformPostResult {
  platformPostId: string;
  platformPostUrl?: string;
  publishedAt: Date;
}

export interface PlatformProfile {
  accountId: string;
  accountName: string;
  avatarUrl?: string;
  followerCount?: number;
}

export interface PlatformAdapterConfig {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  accountId?: string;
}

export abstract class BasePlatformAdapter {
  protected config!: PlatformAdapterConfig;

  setConfig(config: PlatformAdapterConfig): void {
    this.config = config;
  }

  abstract getAuthUrl(redirectUri: string, state: string): string;

  abstract exchangeCode(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;

  abstract refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;

  abstract post(content: string, mediaUrls: string[]): Promise<PlatformPostResult>;

  abstract getProfile(): Promise<PlatformProfile>;

  protected async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response;
  }
}
