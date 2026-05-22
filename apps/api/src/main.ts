import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable CORS for frontend dev servers
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3001',
    ],
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
