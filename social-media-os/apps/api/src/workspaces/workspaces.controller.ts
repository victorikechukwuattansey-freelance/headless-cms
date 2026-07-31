import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private workspacesService: WorkspacesService) {}

  @Post('organizations/:orgId')
  @ApiOperation({ summary: 'Create a workspace in an organization' })
  async create(
    @Param('orgId') orgId: string,
    @Body() data: { name: string; slug?: string },
  ) {
    return this.workspacesService.create(orgId, data);
  }

  @Get('organizations/:orgId')
  @ApiOperation({ summary: 'List workspaces in an organization' })
  async findAll(@Param('orgId') orgId: string) {
    return this.workspacesService.findAll(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workspace by ID' })
  async findOne(@Param('id') id: string) {
    return this.workspacesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workspace' })
  async update(
    @Param('id') id: string,
    @Body() data: { name?: string; slug?: string; brandVoiceId?: string },
  ) {
    return this.workspacesService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete workspace' })
  async remove(@Param('id') id: string) {
    return this.workspacesService.remove(id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to workspace' })
  async addMember(
    @Param('id') id: string,
    @Body() data: { userId: string; role?: string },
  ) {
    return this.workspacesService.addMember(id, data.userId, data.role);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List workspace members' })
  async listMembers(@Param('id') id: string) {
    return this.workspacesService.listMembers(id);
  }

  @Patch(':id/members/:memberId')
  @ApiOperation({ summary: 'Update member role' })
  async updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body('role') role: string,
  ) {
    return this.workspacesService.updateMemberRole(id, memberId, role);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a member from workspace' })
  async removeMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.workspacesService.removeMember(id, memberId);
  }
}
