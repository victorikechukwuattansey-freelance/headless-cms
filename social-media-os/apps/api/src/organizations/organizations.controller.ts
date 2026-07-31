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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-org.dto';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private orgService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  async create(@Body() dto: CreateOrganizationDto, @CurrentUser('id') userId: string) {
    return this.orgService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all organizations' })
  async findAll() {
    return this.orgService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  async findOne(@Param('id') id: string) {
    return this.orgService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organization' })
  async update(
    @Param('id') id: string,
    @Body() data: { name?: string; slug?: string; logoUrl?: string },
  ) {
    return this.orgService.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete organization' })
  async remove(@Param('id') id: string) {
    return this.orgService.remove(id);
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite a member to organization' })
  async invite(
    @Param('id') id: string,
    @Body() data: { email: string; role?: string },
  ) {
    return this.orgService.inviteMember(id, data.email, data.role);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List organization members' })
  async listMembers(@Param('id') id: string) {
    return this.orgService.listMembers(id);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a member from organization' })
  async removeMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.orgService.removeMember(id, memberId);
  }
}
