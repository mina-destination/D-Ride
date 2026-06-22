import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  async connectToRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.logger.log(`Connecting to Redis for WebSockets scaling: ${redisUrl}`);

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) =>
      this.logger.error(`Redis pubClient Error: ${err.message}`),
    );
    subClient.on('error', (err) =>
      this.logger.error(`Redis subClient Error: ${err.message}`),
    );

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Redis socket.io adapter initialized successfully.');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
