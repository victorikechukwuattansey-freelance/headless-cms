import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private prisma: PrismaService) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async create(orgId: string, data: { name: string; slug?: string }) {
    const slug = data.slug || this.slugify(data.name);

    const existing = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug } },
    });

    if (existing) {
      throw new ConflictException('Workspace slug already exists in this organization');
    }

    return this.prisma.workspace.create({
      data: {
        organizationId: orgId,
        name: data.name,
        slug,
      },
    });
  }

  async findAll(orgId: string) {
    return this.prisma.workspace.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { members: true, socialAccounts: true, posts: true } },
      },
    });
  }

  async findById(id: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, subscriptionTier: true },
        },
        _count: { select: { members: true, socialAccounts: true, posts: true } },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async update(id: string, data: { name?: string; slug?: string; brandVoiceId?: string }) {
    await this.findById(id);

    if (data.slug) {
      const workspace = await this.prisma.workspace.findUnique({ where: { id } });
      if (workspace) {
        const existing = await this.prisma.workspace.findUnique({
          where: { organizationId_slug: { organizationId: workspace.organizationId, slug: data.slug } },
        });
        if (existing && existing.id !== id) {
          throw new ConflictException('Workspace slug already exists');
        }
      }
    }

    return this.prisma.workspace.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.workspace.delete({ where: { id } });
  }

  async addMember(workspaceId: string, userId: string, role: string = 'EDITOR') {
    const workspace = await this.findById(workspaceId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (existing) {
      throw new ConflictException('User is already a member');
    }

    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role: role as any,
      },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
    });
  }

  async updateMemberRole(workspaceId: string, memberId: string, role: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException('Member not found in this workspace');
    }

    if (member.role === 'OWNER') {
      throw new ForbiddenException('Cannot change the owner role');
    }

    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: role as any },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
    });
  }

  async removeMember(workspaceId: string, memberId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException('Member not found in this workspace');
    }

    if (member.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove the owner');
    }

    return this.prisma.workspaceMember.delete({ where: { id: memberId } });
  }

  async listMembers(workspaceId: string) {
    await this.findById(workspaceId);

    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
    });
  }
}
