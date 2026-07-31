import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { AutomationEngine } from './automation.engine';

@Module({
  controllers: [AutomationController],
  providers: [AutomationService, AutomationEngine],
  exports: [AutomationService, AutomationEngine],
})
export class AutomationModule {}
