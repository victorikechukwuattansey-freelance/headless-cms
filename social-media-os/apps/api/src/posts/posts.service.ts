import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsQueueService } from './posts-queue.service';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private prisma: PrismaService,
    private postsQueue: PostsQueueService,
  ) {}

  async create(dto: CreatePostDto, authorId: string) {
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;

    if (scheduledAt && scheduledAt <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    const post = await this.prisma.post.create({
      data: {
        workspaceId: dto.workspaceId,
        authorId,
        content: dto.content,
        mediaUrls: dto.mediaUrls || [],
        postType: dto.postType || 'TEXT',
        platforms: dto.platforms,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt,
        campaignId: dto.campaignId || null,
      },
      include: {
        versions: true,
      },
    });

    for (const platform of dto.platforms) {
      await this.prisma.postVersion.create({
        data: {
          postId: post.id,
          platform,
          content: dto.content[platform.toLowerCase()] || dto.content.default || '',
          mediaUrls: dto.mediaUrls || [],
          status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
          scheduledAt,
        },
      });
    }

    if (scheduledAt) {
      await this.postsQueue.schedulePublish(post.id, scheduledAt);
    }

    this.logger.log(`Post created: ${post.id} with status ${post.status}`);

    return this.prisma.post.findUnique({
      where: { id: post.id },
      include: { versions: true },
    });
  }

  async findAll(workspaceId: string, query: {
    status?: string;
    platform?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { workspaceId };
    if (query.status) where.status = query.status;
    if (query.platform) where.platforms = { has: query.platform };

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: { versions: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { versions: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async update(id: string, dto: UpdatePostDto) {
    const post = await this.findById(id);

    if (post.status === 'PUBLISHED') {
      throw new BadRequestException('Cannot update a published post');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.mediaUrls !== undefined) updateData.mediaUrls = dto.mediaUrls;
    if (dto.postType !== undefined) updateData.postType = dto.postType;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.platforms !== undefined) updateData.platforms = dto.platforms;
    if (dto.campaignId !== undefined) updateData.campaignId = dto.campaignId;

    if (dto.scheduledAt) {
      const scheduledAt = new Date(dto.scheduledAt);
      if (scheduledAt <= new Date()) {
        throw new BadRequestException('Scheduled time must be in the future');
      }
      updateData.scheduledAt = scheduledAt;
      if (post.status === 'DRAFT') {
        updateData.status = 'SCHEDULED';
      }
      await this.postsQueue.schedulePublish(id, scheduledAt);
    }

    return this.prisma.post.update({
      where: { id },
      data: updateData,
      include: { versions: true },
    });
  }

  async publish(id: string) {
    const post = await this.findById(id);

    if (post.status === 'PUBLISHED') {
      throw new BadRequestException('Post is already published');
    }

    if (post.status === 'PUBLISHING') {
      throw new BadRequestException('Post is currently being published');
    }

    await this.prisma.post.update({
      where: { id },
      data: { status: 'PUBLISHING' },
    });

    await this.postsQueue.publishImmediately(id);

    return { message: 'Publishing job queued', postId: id };
  }

  async schedule(id: string, scheduledAt: Date) {
    const post = await this.findById(id);

    if (post.status === 'PUBLISHED') {
      throw new BadRequestException('Cannot schedule a published post');
    }

    if (scheduledAt <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    await this.prisma.post.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt },
    });

    await this.postsQueue.schedulePublish(id, scheduledAt);

    return { message: 'Post scheduled', postId: id, scheduledAt };
  }

  async cancel(id: string) {
    const post = await this.findById(id);

    if (post.status === 'PUBLISHED') {
      throw new BadRequestException('Cannot cancel a published post');
    }

    await this.postsQueue.cancelScheduled(id);

    return this.prisma.post.update({
      where: { id },
      data: { status: 'CANCELLED', scheduledAt: null },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.postsQueue.cancelScheduled(id);
    return this.prisma.post.delete({ where: { id } });
  }

  async bulkCreate(dtos: CreatePostDto[], authorId: string) {
    const results = [];
    for (const dto of dtos) {
      results.push(await this.create(dto, authorId));
    }
    return results;
  }

  async getCalendar(workspaceId: string, startDate: Date, endDate: Date) {
    const posts = await this.prisma.post.findMany({
      where: {
        workspaceId,
        scheduledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { versions: true },
      orderBy: { scheduledAt: 'asc' },
    });

    return posts;
  }
}
