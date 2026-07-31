import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Campaign not found');
    return record;
  }

  async create(tenantId: string, dto: any, userId: string) {
    return this.prisma.campaign.create({
      data: { ...dto, tenantId, createdBy: userId },
    });
  }

  async update(tenantId: string, id: string, dto: any, userId: string) {
    await this.findOne(tenantId, id);
    return this.prisma.campaign.update({
      where: { id },
      data: { ...dto, updatedBy: userId },
    });
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
