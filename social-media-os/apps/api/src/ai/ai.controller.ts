import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { GenerateDto } from './dto/generate.dto';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate social media content with AI' })
  async generate(@Body() dto: GenerateDto, @CurrentUser('id') userId: string) {
    return this.aiService.generate(dto, userId);
  }

  @Post('repurpose')
  @ApiOperation({ summary: 'Repurpose content for a different platform' })
  async repurpose(@Body() dto: GenerateDto, @CurrentUser('id') userId: string) {
    return this.aiService.generate(
      { ...dto, action: 'repurpose' as any },
      userId,
    );
  }

  @Post('improve')
  @ApiOperation({ summary: 'Improve existing social media content' })
  async improve(@Body() dto: GenerateDto, @CurrentUser('id') userId: string) {
    return this.aiService.generate(
      { ...dto, action: 'improve' as any },
      userId,
    );
  }

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze content and provide insights' })
  async analyze(@Body() dto: GenerateDto, @CurrentUser('id') userId: string) {
    return this.aiService.generate(
      { ...dto, action: 'analyze' as any },
      userId,
    );
  }
}
