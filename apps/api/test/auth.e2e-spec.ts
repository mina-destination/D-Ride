import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestData } from './helpers/test-db';

describe('Auth E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    // Initial cleanup
    await cleanupTestData(prisma);
  });

  afterAll(async () => {
    // Clean up test users
    await cleanupTestData(prisma);
    await app.close();
  });

  it('POST /api/auth/register — should register new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'E2E Test User',
        email: `e2e_test_${Date.now()}@dride.com`,
        phone: '+201234567890',
        password: 'SecurePass123!',
      })
      .expect(201);

    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe('PASSENGER');
  });

  it('POST /api/auth/login — should reject invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nonexistent@dride.com', password: 'wrongpassword' })
      .expect(401);
  });

  it('GET /api/auth/profile — should reject unauthenticated request', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/profile')
      .expect(401);
  });

  it('POST /api/auth/login — should rate limit after threshold', async () => {
    let throttledCount = 0;
    for (let i = 0; i < 12; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrongpassword' });
      if (res.status === 429) {
        throttledCount++;
      }
    }
    expect(throttledCount).toBeGreaterThan(0);
  });
});
