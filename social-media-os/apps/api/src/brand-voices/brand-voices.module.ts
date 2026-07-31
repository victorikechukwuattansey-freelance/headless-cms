import { Module } from '@nestjs/common';
import { BrandVoicesService } from './brand-voices.service';
import { BrandVoicesController } from './brand-voices.controller';

@Module({
  controllers: [BrandVoicesController],
  providers: [BrandVoicesService],
  exports: [BrandVoicesService],
})
export class BrandVoicesModule {}
