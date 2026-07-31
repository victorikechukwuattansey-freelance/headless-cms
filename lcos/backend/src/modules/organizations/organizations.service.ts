import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const org = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            customers: true,
            orders: true,
          },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(id: string, data: any) {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        name: data.name,
        logo: data.logo,
        brandColor: data.brandColor,
        accentColor: data.accentColor,
        settings: data.settings,
      },
    });
  }
}
