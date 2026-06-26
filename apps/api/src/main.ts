import './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { RedisIoAdapter } from './redis-io.adapter';
import helmet from 'helmet';
import compression from 'compression';
import { AllExceptionsFilter } from './utils/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust reverse proxy (Traefik/Coolify) to get correct client IPs for rate limiting
  const expressApp = app.getHttpAdapter().getInstance();
  if (expressApp && typeof expressApp.set === 'function') {
    expressApp.set('trust proxy', 1);
  }

  const isProduction = process.env.NODE_ENV === 'production';

  // Integrate helmet middleware package for standard production HTTP security hardening
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false, // Swagger UI requires inline scripts and styles in non-production
      crossOriginEmbedderPolicy: isProduction,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
      noSniff: true,
      originAgentCluster: true,
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    }),
  );

  // Mitigate Memory Exhaustion and Payload Attacks by reducing body size limits
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: true, limit: '256kb' }));

  const logger = new Logger('Bootstrap');

  // Enable scalable Redis IoAdapter if REDIS_URL is configured
  if (process.env.REDIS_URL) {
    const redisIoAdapter = new RedisIoAdapter(app);
    try {
      await redisIoAdapter.connectToRedis();
      app.useWebSocketAdapter(redisIoAdapter);
      logger.log('Scalable Redis WebSocket adapter enabled.');
    } catch (err: any) {
      logger.error(
        `Failed to connect to Redis. Falling back to default adapter: ${err.message}`,
      );
    }
  }

  // Enable high-velocity Gzip network compression right before validation pipes
  app.use(compression());

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable global exception filter for standardized error responses
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable CORS using environment-driven origin lookups (whitelisting passenger app, driver portal, and admin dashboard)
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  let origins: string[] = [];

  if (allowedOriginsEnv) {
    origins = allowedOriginsEnv.split(',').map((origin) => origin.trim());
    if (isProduction) {
      origins = origins.filter(
        (o) =>
          !o.includes('127.0.0.1') &&
          (o === 'capacitor://localhost' || o === 'http://localhost' || o === 'https://localhost' || !o.includes('localhost')),
      );
    }
  } else {
    if (isProduction) {
      throw new Error(
        'ALLOWED_ORIGINS environment variable is required in production',
      );
    }
    origins = [
      'http://localhost:5173', // passenger client app
      'http://localhost:5174', // driver portal
      'http://localhost:5175', // admin dashboard
      'http://localhost:3001',
    ];
  }

  // Always allow Capacitor/Cordova mobile app localhost origins (in dev and prod)
  if (!origins.includes('https://localhost')) {
    origins.push('https://localhost');
  }
  if (!origins.includes('capacitor://localhost')) {
    origins.push('capacitor://localhost');
  }
  if (!origins.includes('http://localhost')) {
    origins.push('http://localhost');
  }

  // Always allow D-Ride production/staging domains
  const prodOrigins = [
    'https://d-ride.net',
    'https://admin.d-ride.net',
    'https://api.d-ride.net',
    'https://passenger.d-ride.net',
    'https://driver.d-ride.net',
  ];
  prodOrigins.forEach((o) => {
    if (!origins.includes(o)) {
      origins.push(o);
    }
  });

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,
  });

  // Global API prefix
  app.setGlobalPrefix('api', { exclude: ['/', 'health'] });

  // Secure Swagger API Documentation Portal - Only available in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('D-Ride API')
      .setDescription(
        'The D-Ride Autonomous Mass-Transit Platform API Specification',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customfavIcon:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      swaggerOptions: {
        deepLinking: true,
      },
    });
  }

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  const server = await app.listen(port, '0.0.0.0');

  // Set server timeouts
  if (typeof server.setTimeout === 'function') {
    server.setTimeout(30000); // 30s max request duration
  }
  if ('keepAliveTimeout' in server) {
    server.keepAliveTimeout = 65000; // Must be > ALB idle timeout (60s)
  }
  if ('headersTimeout' in server) {
    server.headersTimeout = 66000;
  }

  logger.log(`🚀 D-Ride API running on http://localhost:${port}/api`);

  if (process.env.NODE_ENV !== 'production') {
    logger.log(
      `📚 API Portal (Swagger docs) available at http://localhost:${port}/api/docs`,
    );
  }
}
bootstrap();

// Uncaught exception handlers — prevent silent crashes
process.on('unhandledRejection', (reason: any) => {
  console.error('UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});
