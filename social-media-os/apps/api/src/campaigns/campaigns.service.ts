import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: {
    workspaceId: string;
    name: string;
    description?: string;
    startDate: string;
    endDate?: string;
    platforms: string[];
  }) {
    const startDate = new Date(data.startDate);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid start date');
    }

    const endDate = data.endDate ? new Date(data.endDate) : null;
    if (endDate && isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid end date');
    }

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    return this.prisma.campaign.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        description: data.description || null,
        startDate,
        endDate,
        platforms: data.platforms as any,
        status: 'draft',
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.campaign.findMany({
      where: { workspaceId },
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findById(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        posts: {
          include: { versions: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async update(id: string, data: {
    name?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    platforms?: string[];
    status?: string;
  }) {
    await this.findById(id);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.platforms !== undefined) updateData.platforms = data.platforms;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;

    return this.prisma.campaign.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.campaign.delete({ where: { id } });
  }

  async updateStatus(id: string, status: string) {
    const validStatuses = ['draft', 'active', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    await this.findById(id);
    return this.prisma.campaign.update({
      where: { id },
      data: { status },
    });
  }
}
