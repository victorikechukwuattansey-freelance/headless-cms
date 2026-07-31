import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EngagementService } from './engagement.service';

@ApiTags('engagement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('engagement')
export class EngagementController {
  constructor(private engagementService: EngagementService) {}

  @Get('comments')
  @ApiOperation({ summary: 'Get comments feed' })
  @ApiQuery({ name: 'workspaceId', required: true })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'postId', required: false })
  async getComments(
    @Query('workspaceId') workspaceId: string,
    @Query('platform') platform?: string,
    @Query('postId') postId?: string,
  ) {
    return this.engagementService.getComments(workspaceId, platform, postId);
  }

  @Post('reply')
  @ApiOperation({ summary: 'Reply to a comment' })
  async replyToComment(@Body() data: {
    workspaceId: string;
    platform: string;
    postId: string;
    commentId: string;
    replyText: string;
  }) {
    return this.engagementService.replyToComment(data);
  }

  @Post('analyze-sentiment')
  @ApiOperation({ summary: 'Analyze sentiment of comments' })
  async analyzeSentiment(@Body('comments') comments: string[]) {
    return this.engagementService.analyzeSentiment(comments);
  }

  @Post('draft-reply')
  @ApiOperation({ summary: 'Draft an AI reply to a comment' })
  async draftReply(
    @Body('comment') comment: string,
    @Body('brandVoiceId') brandVoiceId?: string,
  ) {
    const reply = await this.engagementService.draftReply(comment, brandVoiceId);
    return { reply };
  }
}
