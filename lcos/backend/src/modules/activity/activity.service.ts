import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: any, userId: string) {
    return this.prisma.activityLog.create({
      data: { ...dto, tenantId, createdBy: userId },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.activityLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.activityLog.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Activity log not found');
    return record;
  }

  async update(tenantId: string, id: string, dto: any, userId: string) {
    await this.findOne(tenantId, id);
    return this.prisma.activityLog.update({
      where: { id },
      data: { ...dto, updatedBy: userId },
    });
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.activityLog.delete({
      where: { id },
    });
  }
}
