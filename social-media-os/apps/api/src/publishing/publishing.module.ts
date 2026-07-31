import { Module } from '@nestjs/common';
import { PublishingProcessor } from './publishing.processor';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';

@Module({
  imports: [SocialAccountsModule],
  providers: [PublishingProcessor],
  exports: [PublishingProcessor],
})
export class PublishingModule {}
