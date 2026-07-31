import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-org.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private prisma: PrismaService) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async create(dto: CreateOrganizationDto, userId: string) {
    const slug = dto.slug || this.slugify(dto.name);

    const existing = await this.prisma.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException('Organization slug already exists');
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug,
        logoUrl: dto.logoUrl || null,
      },
    });

    const workspace = await this.prisma.workspace.create({
      data: {
        organizationId: org.id,
        name: 'Default',
        slug: 'default',
      },
    });

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: 'OWNER',
      },
    });

    this.logger.log(`Organization created: ${org.name} (${slug}) by user ${userId}`);

    return org;
  }

  async findAll() {
    return this.prisma.organization.findMany({
      include: {
        workspaces: {
          include: {
            _count: {
              select: { members: true, socialAccounts: true, posts: true },
            },
          },
        },
        _count: {
          select: { workspaces: true },
        },
      },
    });
  }

  async findById(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        workspaces: {
          include: {
            _count: { select: { members: true, socialAccounts: true, posts: true } },
          },
        },
        _count: { select: { workspaces: true } },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async update(id: string, data: { name?: string; slug?: string; logoUrl?: string }) {
    await this.findById(id);

    if (data.slug) {
      const existing = await this.prisma.organization.findUnique({
        where: { slug: data.slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Organization slug already exists');
      }
    }

    return this.prisma.organization.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.organization.delete({ where: { id } });
  }

  async inviteMember(orgId: string, email: string, role: string = 'EDITOR') {
    const org = await this.findById(orgId);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('User with this email not found');
    }

    const workspace = await this.prisma.workspace.findFirst({
      where: { organizationId: orgId },
    });

    if (!workspace) {
      throw new NotFoundException('No workspace found in organization');
    }

    const existing = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a member');
    }

    const member = await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: role as any,
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    this.logger.log(`User ${email} invited to organization ${org.name}`);

    return member;
  }

  async listMembers(orgId: string) {
    await this.findById(orgId);

    const workspace = await this.prisma.workspace.findFirst({
      where: { organizationId: orgId },
    });

    if (!workspace) return [];

    return this.prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  async removeMember(orgId: string, memberId: string) {
    await this.findById(orgId);

    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
      include: { workspace: true },
    });

    if (!member || member.workspace.organizationId !== orgId) {
      throw new NotFoundException('Member not found in this organization');
    }

    if (member.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove the owner');
    }

    return this.prisma.workspaceMember.delete({
      where: { id: memberId },
    });
  }
}
