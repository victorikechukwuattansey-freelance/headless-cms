import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'unknown',
        redis: 'unknown',
      },
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      status.services.database = 'healthy';
    } catch (error) {
      status.status = 'degraded';
      status.services.database = 'unhealthy';
      this.logger.error('Database health check failed', error as Error);
    }

    try {
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = process.env.REDIS_PORT || '6379';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`http://${redisHost}:${redisPort}/ping`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      status.services.redis = response.ok ? 'healthy' : 'unhealthy';
    } catch {
      status.services.redis = 'unhealthy';
    }

    return status;
  }
}
