import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationsService } from './organizations.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current organization settings' })
  async getCurrent(@CurrentUser() user: any) {
    return this.orgsService.findById(user.tenantId);
  }

  @Put()
  @ApiOperation({ summary: 'Update organization settings' })
  async update(@Body() body: any, @CurrentUser() user: any) {
    return this.orgsService.update(user.tenantId, body);
  }
}
