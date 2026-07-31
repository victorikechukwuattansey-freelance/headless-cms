import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('plan')
  @ApiOperation({ summary: 'Get current billing plan' })
  @ApiQuery({ name: 'orgId', required: true })
  async getPlan(@Query('orgId') orgId: string) {
    return this.billingService.getPlan(orgId);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get current usage statistics' })
  @ApiQuery({ name: 'orgId', required: true })
  async getUsage(@Query('orgId') orgId: string) {
    return this.billingService.getUsage(orgId);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Create checkout session for plan upgrade' })
  async createCheckout(
    @Body() data: { orgId: string; tier: string },
  ) {
    return this.billingService.createCheckoutSession(data.orgId, data.tier);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Get billing invoices' })
  @ApiQuery({ name: 'orgId', required: true })
  async getInvoices(@Query('orgId') orgId: string) {
    return this.billingService.getInvoices(orgId);
  }

  @Get('usage-records')
  @ApiOperation({ summary: 'Get usage records' })
  @ApiQuery({ name: 'orgId', required: true })
  @ApiQuery({ name: 'feature', required: false })
  async getUsageRecords(
    @Query('orgId') orgId: string,
    @Query('feature') feature?: string,
  ) {
    return this.billingService.getUsageRecords(orgId, feature);
  }
}
