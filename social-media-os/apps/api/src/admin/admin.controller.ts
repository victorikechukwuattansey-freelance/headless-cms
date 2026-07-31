import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get system-wide statistics (admin only)' })
  async getStats() {
    const [
      totalUsers,
      totalOrganizations,
      totalWorkspaces,
      totalPosts,
      totalSocialAccounts,
      totalAiGenerations,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.organization.count(),
      this.prisma.workspace.count(),
      this.prisma.post.count(),
      this.prisma.socialAccount.count(),
      this.prisma.aIGeneration.count(),
    ]);

    return {
      totalUsers,
      totalOrganizations,
      totalWorkspaces,
      totalPosts,
      totalSocialAccounts,
      totalAiGenerations,
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin only)' })
  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations (admin only)' })
  async listOrganizations() {
    return this.prisma.organization.findMany({
      include: { _count: { select: { workspaces: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('errors')
  @ApiOperation({ summary: 'Get recent failed post attempts (admin only)' })
  async getFailedPosts() {
    const failedPosts = await this.prisma.post.findMany({
      where: { status: 'FAILED' },
      include: {
        versions: {
          where: { status: 'FAILED' },
          select: { platform: true, errorMessage: true, updatedAt: true },
        },
        workspace: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return failedPosts
      .filter((p) => p.versions.length > 0)
      .map((p) => ({
        postId: p.id,
        workspace: p.workspace.name,
        versions: p.versions,
        lastAttempt: p.updatedAt,
      }));
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Deactivate a user (admin only)' })
  async deactivateUser(@Param('id') id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true },
    });
  }
}
