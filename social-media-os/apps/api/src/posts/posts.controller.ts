import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@ApiTags('posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new post' })
  async create(@Body() dto: CreatePostDto, @CurrentUser('id') userId: string) {
    return this.postsService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List posts with pagination and filtering' })
  @ApiQuery({ name: 'workspaceId', required: true, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'platform', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async findAll(
    @Query('workspaceId') workspaceId: string,
    @Query('status') status?: string,
    @Query('platform') platform?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.postsService.findAll(workspaceId, { status, platform, page, pageSize });
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get posts calendar for date range' })
  @ApiQuery({ name: 'workspaceId', required: true, type: String })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getCalendar(
    @Query('workspaceId') workspaceId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.postsService.getCalendar(
      workspaceId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get post by ID' })
  async findOne(@Param('id') id: string) {
    return this.postsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a post' })
  async update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.postsService.update(id, dto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a post immediately' })
  async publish(@Param('id') id: string) {
    return this.postsService.publish(id);
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Schedule a post for publishing' })
  async schedule(
    @Param('id') id: string,
    @Body('scheduledAt') scheduledAt: string,
  ) {
    return this.postsService.schedule(id, new Date(scheduledAt));
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a scheduled post' })
  async cancel(@Param('id') id: string) {
    return this.postsService.cancel(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post' })
  async remove(@Param('id') id: string) {
    return this.postsService.remove(id);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create posts' })
  async bulkCreate(@Body() dtos: CreatePostDto[], @CurrentUser('id') userId: string) {
    return this.postsService.bulkCreate(dtos, userId);
  }
}
