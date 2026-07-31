import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: any, userId: string) {
    return this.prisma.authenticationLog.create({
      data: { ...dto, tenantId, createdBy: userId },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.authenticationLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.authenticationLog.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Authentication record not found');
    return record;
  }

  async update(tenantId: string, id: string, dto: any, userId: string) {
    await this.findOne(tenantId, id);
    return this.prisma.authenticationLog.update({
      where: { id },
      data: { ...dto },
    });
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.authenticationLog.delete({
      where: { id },
    });
  }
}
