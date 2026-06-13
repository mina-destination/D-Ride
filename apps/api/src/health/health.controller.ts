import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from 'redis';

@Controller('health')
export class HealthController {
  private startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Res() res: Response) {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
    let allHealthy = true;

    // 1. PostgreSQL check
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart };
    } catch (err: any) {
      checks.database = { status: 'unhealthy', latencyMs: Date.now() - dbStart, error: err.message };
      allHealthy = false;
    }

    // 2. Redis check
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const redisStart = Date.now();
      let redisClient: ReturnType<typeof createClient> | null = null;
      try {
        redisClient = createClient({ url: redisUrl, socket: { connectTimeout: 3000 } });
        await redisClient.connect();
        await redisClient.ping();
        checks.redis = { status: 'healthy', latencyMs: Date.now() - redisStart };
      } catch (err: any) {
        checks.redis = { status: 'unhealthy', latencyMs: Date.now() - redisStart, error: err.message };
        allHealthy = false;
      } finally {
        if (redisClient) {
          try { await redisClient.disconnect(); } catch { /* ignore */ }
        }
      }
    } else {
      checks.redis = { status: 'not_configured' };
    }

    // 3. Uptime & memory
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const memUsage = process.memoryUsage();

    const statusCode = allHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: {
        seconds: uptimeSeconds,
        human: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
      },
      memory: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      },
      checks,
      timestamp: new Date().toISOString(),
    });
  }
}
