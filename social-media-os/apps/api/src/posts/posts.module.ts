import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PostsQueueService } from './posts-queue.service';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';

@Module({
  imports: [SocialAccountsModule],
  controllers: [PostsController],
  providers: [PostsService, PostsQueueService],
  exports: [PostsService, PostsQueueService],
})
export class PostsModule {}
