import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, inventoryStatus?: string) {
    const where: any = { tenantId };
    if (inventoryStatus) where.inventoryStatus = inventoryStatus;
    return this.prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Product not found');
    return record;
  }

  async updateInventoryStatus(tenantId: string, id: string, dto: any, userId: string) {
    await this.findOne(tenantId, id);
    return this.prisma.product.update({
      where: { id },
      data: { ...dto, updatedBy: userId },
    });
  }

  async adjust(tenantId: string, dto: any, userId: string) {
    const log = await this.prisma.inventoryLog.create({
      data: { ...dto, tenantId, createdBy: userId },
    });

    if (dto.productId) {
      await this.prisma.product.update({
        where: { id: dto.productId },
        data: { inventoryStatus: dto.newStatus || dto.status },
      });
    }

    return log;
  }
}
