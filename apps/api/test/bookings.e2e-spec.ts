import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestData } from './helpers/test-db';

describe('Bookings E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let passengerToken: string;
  let driverToken: string;
  let passengerUserId: string;
  let createdRouteId: string;
  let createdTripId: string;
  let createdBookingId: string;
  let qrVerificationToken: string;

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

    // 1. Register passenger
    const passEmail = `e2e_test_passenger_${Date.now()}@dride.com`;
    const passRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'E2E Passenger User',
        email: passEmail,
        phone: '+201234567893',
        password: 'SecurePass123!',
      })
      .expect(201);
    passengerToken = passRes.body.data.accessToken;
    passengerUserId = passRes.body.data.user.id;

    // Credit passenger wallet balance
    await prisma.user.update({
      where: { id: passengerUserId },
      data: { walletBalance: 1000 },
    });

    // 2. Register admin
    const adminEmail = `e2e_test_admin_${Date.now()}@dride.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'E2E Admin User',
        email: adminEmail,
        phone: '+201234567894',
        password: 'SecurePass123!',
      })
      .expect(201);

    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN' },
    });

    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: adminEmail,
        password: 'SecurePass123!',
      })
      .expect(201);
    adminToken = adminLoginRes.body.data.accessToken;

    // 3. Register driver
    const driverEmail = `e2e_test_driver_${Date.now()}@dride.com`;
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'E2E Driver User',
        email: driverEmail,
        phone: '+201234567895',
        password: 'SecurePass123!',
      })
      .expect(201);

    await prisma.user.update({
      where: { email: driverEmail },
      data: { role: 'DRIVER' },
    });

    const driverLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: driverEmail,
        password: 'SecurePass123!',
      })
      .expect(201);
    driverToken = driverLoginRes.body.data.accessToken;

    // 4. Create a Route
    const route = await prisma.route.create({
      data: {
        name: 'E2E_TEST_Booking_Route',
        path: {
          type: 'LineString',
          coordinates: [
            [31.2, 30.0],
            [29.9, 31.2],
          ],
        },
        checkpoints: [
          {
            id: 'cp-start-id',
            name: 'E2E Start Checkpoint',
            type: 'START',
            order: 0,
            location: { type: 'Point', coordinates: [31.2, 30.0] },
            city: 'Cairo',
            priceFromStartEGP: 0,
            minutesFromStart: 0,
          },
          {
            id: 'cp-end-id',
            name: 'E2E End Checkpoint',
            type: 'END',
            order: 1,
            location: { type: 'Point', coordinates: [29.9, 31.2] },
            city: 'Alexandria',
            priceFromStartEGP: 100,
            minutesFromStart: 180,
          },
        ],
        distanceKm: 200,
        estimatedDurationMinutes: 180,
      },
    });
    createdRouteId = route.id;

    // 5. Create a Trip
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trip = await prisma.trip.create({
      data: {
        routeId: createdRouteId,
        departureTime: tomorrow,
        priceEGP: 100,
        availableSeats: 14,
        status: 'SCHEDULED',
      },
    });
    createdTripId = trip.id;
  });

  afterAll(async () => {
    await cleanupTestData(prisma);
    await app.close();
  });

  it('POST /api/bookings — should create a booking with status CONFIRMED using wallet payment', async () => {
    const bookingRes = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({
        tripId: createdTripId,
        seatNumbers: [1, 2],
        pickupStopId: 'E2E Start Checkpoint',
        dropoffStopId: 'E2E End Checkpoint',
        paymentMethod: 'WALLET',
      })
      .expect(201);

    expect(bookingRes.body.success).toBe(true);
    expect(bookingRes.body.data.id).toBeDefined();
    expect(bookingRes.body.data.status).toBe('CONFIRMED');
    expect(bookingRes.body.data.amountEGP).toBe(200); // 100 EGP * 2 seats

    createdBookingId = bookingRes.body.data.id;
    qrVerificationToken = bookingRes.body.data.qrVerificationToken;

    // Check wallet deduction
    const updatedUser = await prisma.user.findUnique({
      where: { id: passengerUserId },
    });
    expect(updatedUser?.walletBalance).toBe(800); // 1000 - 200
  });

  it('GET /api/bookings/occupied/:tripId — should show booked seats as occupied', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/bookings/occupied/${createdTripId}`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .query({
        pickupCheckpointName: 'E2E Start Checkpoint',
        dropoffCheckpointName: 'E2E End Checkpoint',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toContain(1);
    expect(res.body.data).toContain(2);
  });

  it('GET /api/bookings/my-bookings — should retrieve passenger bookings', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/bookings/my-bookings')
      .set('Authorization', `Bearer ${passengerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((b: any) => b.id === createdBookingId)).toBe(
      true,
    );
  });

  it('GET /api/bookings/:id — should return single booking details', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/bookings/${createdBookingId}`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdBookingId);
    expect(res.body.data.status).toBe('CONFIRMED');
  });

  it('GET /api/bookings/trip/:tripId/manifest — driver should fetch trip manifest; passenger should be forbidden', async () => {
    // 1. Driver manifest access
    const driverRes = await request(app.getHttpServer())
      .get(`/api/bookings/trip/${createdTripId}/manifest`)
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);

    expect(driverRes.body.success).toBe(true);
    expect(Array.isArray(driverRes.body.data)).toBe(true);
    expect(
      driverRes.body.data.some((b: any) => b.id === createdBookingId),
    ).toBe(true);

    // 2. Passenger forbidden access
    await request(app.getHttpServer())
      .get(`/api/bookings/trip/${createdTripId}/manifest`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .expect(403);
  });

  it('PUT /api/bookings/:id/check-in — driver should check in the passenger; passenger should be forbidden', async () => {
    // 1. Passenger forbidden access
    await request(app.getHttpServer())
      .put(`/api/bookings/${createdBookingId}/check-in`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .expect(403);

    // 2. Driver check-in passenger
    const driverRes = await request(app.getHttpServer())
      .put(`/api/bookings/${createdBookingId}/check-in`)
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);

    expect(driverRes.body.success).toBe(true);
    expect(driverRes.body.data.status).toBe('BOARDED');
  });

  it('PUT /api/bookings/:id/verify-ticket — driver should verify the booking ticket', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/bookings/${createdBookingId}/verify-ticket`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ token: qrVerificationToken })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdBookingId);
  });

  it('PUT /api/bookings/:id/cancel — passenger should successfully cancel their booking', async () => {
    const res = await request(app.getHttpServer())
      .put(`/api/bookings/${createdBookingId}/cancel`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('CANCELLED');

    // Confirm seats are no longer occupied
    const occupiedRes = await request(app.getHttpServer())
      .get(`/api/bookings/occupied/${createdTripId}`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .query({
        pickupCheckpointName: 'E2E Start Checkpoint',
        dropoffCheckpointName: 'E2E End Checkpoint',
      })
      .expect(200);

    expect(occupiedRes.body.data).not.toContain(1);
    expect(occupiedRes.body.data).not.toContain(2);
  });

  it('GET /api/bookings — admin should retrieve all bookings; passenger should be forbidden', async () => {
    // 1. Passenger forbidden access
    await request(app.getHttpServer())
      .get('/api/bookings')
      .set('Authorization', `Bearer ${passengerToken}`)
      .expect(403);

    // 2. Admin retrieves all bookings
    const adminRes = await request(app.getHttpServer())
      .get('/api/bookings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(adminRes.body.success).toBe(true);
    expect(Array.isArray(adminRes.body.data)).toBe(true);
    expect(adminRes.body.data.some((b: any) => b.id === createdBookingId)).toBe(
      true,
    );
  });
});
