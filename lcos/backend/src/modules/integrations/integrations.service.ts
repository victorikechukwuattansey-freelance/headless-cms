import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: any, userId: string) {
    return this.prisma.integration.create({
      data: { ...dto, tenantId, createdBy: userId },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.integration.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.integration.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!record) throw new NotFoundException('Integration not found');
    return record;
  }

  async update(tenantId: string, id: string, dto: any, userId: string) {
    await this.findOne(tenantId, id);
    return this.prisma.integration.update({
      where: { id },
      data: { ...dto, updatedBy: userId },
    });
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.integration.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
