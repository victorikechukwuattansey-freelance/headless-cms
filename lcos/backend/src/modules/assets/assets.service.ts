import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: any, userId: string) {
    return this.prisma.asset.create({
      data: { ...dto, tenantId, createdBy: userId },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.asset.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!record) throw new NotFoundException('Asset not found');
    return record;
  }

  async update(tenantId: string, id: string, dto: any, userId: string) {
    await this.findOne(tenantId, id);
    return this.prisma.asset.update({
      where: { id },
      data: { ...dto, updatedBy: userId },
    });
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.asset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
