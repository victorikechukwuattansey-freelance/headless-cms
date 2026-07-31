import { Module } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service';
import { SocialAccountsController } from './social-accounts.controller';
import { FacebookAdapter } from './platforms/facebook.adapter';
import { InstagramAdapter } from './platforms/instagram.adapter';
import { TwitterAdapter } from './platforms/twitter.adapter';
import { LinkedInAdapter } from './platforms/linkedin.adapter';
import { TikTokAdapter } from './platforms/tiktok.adapter';

@Module({
  controllers: [SocialAccountsController],
  providers: [
    SocialAccountsService,
    FacebookAdapter,
    InstagramAdapter,
    TwitterAdapter,
    LinkedInAdapter,
    TikTokAdapter,
  ],
  exports: [
    SocialAccountsService,
    FacebookAdapter,
    InstagramAdapter,
    TwitterAdapter,
    LinkedInAdapter,
    TikTokAdapter,
  ],
})
export class SocialAccountsModule {}
