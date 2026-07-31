import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: any, userId: string) {
    return this.prisma.customer.create({
      data: { ...dto, tenantId, createdBy: userId },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.customer.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.customer.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!record) throw new NotFoundException('Customer not found');
    return record;
  }

  async update(tenantId: string, id: string, dto: any, userId: string) {
    await this.findOne(tenantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: { ...dto, updatedBy: userId },
    });
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
