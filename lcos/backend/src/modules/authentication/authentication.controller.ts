import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthenticationService } from './authentication.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('authentication')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post()
  @ApiOperation({ summary: 'Create an authentication record' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Authentication record created' })
  async create(@Body() dto: any, @CurrentUser() user: any) {
    return this.authenticationService.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all authentication records' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Authentication records retrieved' })
  async findAll(@CurrentUser() user: any) {
    return this.authenticationService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get authentication record by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Authentication record found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Authentication record not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.authenticationService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update authentication record' })
  async update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.authenticationService.update(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete authentication record' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Authentication record deleted' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.authenticationService.softDelete(user.tenantId, id);
  }
}
