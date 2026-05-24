import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { RedisIoAdapter } from './redis-io.adapter';
import helmet from 'helmet';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Integrate helmet middleware package for standard production HTTP security hardening
  app.use(helmet());

  // Increase payload size limits for large routes
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  const logger = new Logger('Bootstrap');

  // Enable scalable Redis IoAdapter if REDIS_URL is configured
  if (process.env.REDIS_URL) {
    const redisIoAdapter = new RedisIoAdapter(app);
    try {
      await redisIoAdapter.connectToRedis();
      app.useWebSocketAdapter(redisIoAdapter);
      logger.log('Scalable Redis WebSocket adapter enabled.');
    } catch (err: any) {
      logger.error(`Failed to connect to Redis. Falling back to default adapter: ${err.message}`);
    }
  }


  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS using environment-driven origin lookups (whitelisting passenger app, driver portal, and admin dashboard)
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  const origins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map((origin) => origin.trim())
    : [
        'http://localhost:5173', // passenger client app
        'http://localhost:5174', // driver portal
        'http://localhost:5175', // admin dashboard
        'http://localhost:3001',
      ];

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // Swagger API Documentation Portal
  const config = new DocumentBuilder()
    .setTitle('D-Ride API')
    .setDescription(
      'The D-Ride Autonomous Mass-Transit Platform API Specification',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 D-Ride API running on http://localhost:${port}/api`);
  logger.log(
    `📚 API Portal (Swagger docs) available at http://localhost:${port}/api/docs`,
  );
}
bootstrap();
