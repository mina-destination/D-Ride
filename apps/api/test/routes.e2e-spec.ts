import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestData } from './helpers/test-db';

describe('Routes E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let passengerToken: string;
  let createdRouteId: string;
  let createdTripId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    // Clean up before starting
    await cleanupTestData(prisma);

    // Register a passenger to get passengerToken
    const passEmail = `e2e_test_passenger_${Date.now()}@dride.com`;
    const passRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'E2E Passenger User',
        email: passEmail,
        phone: '+201234567891',
        password: 'SecurePass123!',
      })
      .expect(201);
    passengerToken = passRes.body.data.accessToken;

    // Register an admin
    const adminEmail = `e2e_test_admin_${Date.now()}@dride.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'E2E Admin User',
        email: adminEmail,
        phone: '+201234567892',
        password: 'SecurePass123!',
      })
      .expect(201);

    // Elevate the admin user in database
    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN' },
    });

    // Log in as admin to get adminToken
    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: 'SecurePass123!',
      })
      .expect(201);
    adminToken = adminLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  });

  const routeData = {
    name: 'E2E_TEST_Cairo_Alex_Route',
    path: {
      type: 'LineString',
      coordinates: [
        [31.2357, 30.0444],
        [29.9187, 31.2001],
      ],
    },
    distanceKm: 220,
    estimatedDurationMinutes: 180,
    isActive: true,
    checkpoints: [
      {
        name: 'Cairo Start Point',
        type: 'START',
        order: 0,
        location: {
          type: 'Point',
          coordinates: [31.2357, 30.0444],
        },
        city: 'Cairo',
        priceFromStartEGP: 0,
        minutesFromStart: 0,
      },
      {
        name: 'Alex End Point',
        type: 'END',
        order: 1,
        location: {
          type: 'Point',
          coordinates: [29.9187, 31.2001],
        },
        city: 'Alexandria',
        priceFromStartEGP: 150,
        minutesFromStart: 180,
      },
    ],
  };

  it('POST /api/routes — passenger should be forbidden from creating route', async () => {
    await request(app.getHttpServer())
      .post('/api/routes')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send(routeData)
      .expect(403);
  });

  it('POST /api/routes — admin should successfully create a route', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(routeData)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe(routeData.name);
    createdRouteId = res.body.data.id;
  });

  it('GET /api/routes — should return all active routes', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/routes')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((r: any) => r.id === createdRouteId)).toBe(true);
  });

  it('GET /api/routes/:id — should return details of a specific route', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/routes/${createdRouteId}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdRouteId);
    expect(res.body.data.name).toBe(routeData.name);
  });

  it('GET /api/routes/nearby — should query checkpoints near given lat/lng', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/routes/nearby')
      .query({ lat: '30.0444', lng: '31.2357', radius: '5000' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((r: any) => r.id === createdRouteId)).toBe(true);
  });

  it('GET /api/routes/nearest — should find nearest checkpoints', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/routes/nearest')
      .query({ lat: '30.0444', lng: '31.2357', limit: '5' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((c: any) => c.route.id === createdRouteId)).toBe(
      true,
    );
  });

  it('GET /api/routes/:id/nearest-checkpoint — should find nearest checkpoint on a route', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/routes/${createdRouteId}/nearest-checkpoint`)
      .query({ lat: '30.0444', lng: '31.2357' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Cairo Start Point');
  });

  it('GET /api/routes/smart-search — should return search results including matching trips', async () => {
    // First, let's create a Trip on our created route using the Admin token
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tripData = {
      routeId: createdRouteId,
      departureTime: tomorrow.toISOString(),
      priceEGP: 120,
      availableSeats: 14,
      status: 'SCHEDULED',
    };

    const tripRes = await request(app.getHttpServer())
      .post('/api/trips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(tripData)
      .expect(201);

    createdTripId = tripRes.body.data.id;

    // Now test smart search by coordinates
    const searchRes = await request(app.getHttpServer())
      .get('/api/routes/smart-search')
      .query({
        pickupLat: '30.0444',
        pickupLng: '31.2357',
        dropoffLat: '31.2001',
        dropoffLng: '29.9187',
        radius: '5000',
      })
      .expect(200);

    expect(searchRes.body.success).toBe(true);
    expect(Array.isArray(searchRes.body.data)).toBe(true);
    expect(
      searchRes.body.data.some((item: any) => item.trip.id === createdTripId),
    ).toBe(true);

    // Test smart search by cities
    const searchCityRes = await request(app.getHttpServer())
      .get('/api/routes/smart-search')
      .query({
        pickupCity: 'Cairo',
        dropoffCity: 'Alexandria',
      })
      .expect(200);

    expect(searchCityRes.body.success).toBe(true);
    expect(Array.isArray(searchCityRes.body.data)).toBe(true);
    expect(
      searchCityRes.body.data.some(
        (item: any) => item.trip.id === createdTripId,
      ),
    ).toBe(true);
  });

  it('PUT /api/routes/:id — admin should update route details', async () => {
    const updatedName = 'E2E_TEST_Cairo_Alex_Route_Updated';
    const res = await request(app.getHttpServer())
      .put(`/api/routes/${createdRouteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...routeData,
        name: updatedName,
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(updatedName);
  });

  it('DELETE /api/routes/:id — admin should soft-delete the route', async () => {
    await request(app.getHttpServer())
      .delete(`/api/routes/${createdRouteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const getRes = await request(app.getHttpServer())
      .get('/api/routes')
      .expect(200);

    expect(getRes.body.data.some((r: any) => r.id === createdRouteId)).toBe(
      false,
    );
  });
});
