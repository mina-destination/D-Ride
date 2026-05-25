import { Page } from '@playwright/test';

export const MOCK_USER = {
  _id: 'user-123',
  name: 'Test Passenger',
  email: 'passenger@dride.com',
  phone: '01012345678',
  role: 'PASSENGER',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const MOCK_ROUTES = [
  {
    _id: 'route-1',
    name: 'Maadi to Smart Village',
    nameAr: 'المعادي إلى القرية الذكية',
    path: {
      type: 'LineString',
      coordinates: [
        [31.25, 29.96],
        [31.15, 30.01],
        [30.78, 30.08],
      ],
    },
    stops: [],
    checkpoints: [
      {
        _id: 'cp-1',
        name: 'Maadi Square',
        nameAr: 'ميدان المعادي',
        location: { type: 'Point', coordinates: [31.25, 29.96] },
        order: 1,
      },
      {
        _id: 'cp-2',
        name: 'Ring Road',
        nameAr: 'الطريق الدائري',
        location: { type: 'Point', coordinates: [31.15, 30.01] },
        order: 2,
      },
      {
        _id: 'cp-3',
        name: 'Smart Village Gate',
        nameAr: 'بوابة القرية الذكية',
        location: { type: 'Point', coordinates: [30.78, 30.08] },
        order: 3,
      },
    ],
    estimatedDurationMinutes: 45,
    distanceKm: 35,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'route-2',
    name: 'Heliopolis to Fifth Settlement',
    nameAr: 'مصر الجديدة إلى التجمع الخامس',
    path: {
      type: 'LineString',
      coordinates: [
        [31.34, 30.10],
        [31.48, 30.02],
      ],
    },
    stops: [],
    checkpoints: [
      {
        _id: 'cp-4',
        name: 'Heliopolis Square',
        nameAr: 'ميدان مصر الجديدة',
        location: { type: 'Point', coordinates: [31.34, 30.1] },
        order: 1,
      },
      {
        _id: 'cp-5',
        name: 'Teseen Street',
        nameAr: 'شارع التسعين',
        location: { type: 'Point', coordinates: [31.48, 30.02] },
        order: 2,
      },
    ],
    estimatedDurationMinutes: 30,
    distanceKm: 20,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const MOCK_TRIPS = [
  {
    _id: 'trip-1',
    routeId: MOCK_ROUTES[0],
    vehicleId: 'vehicle-123',
    driverId: 'driver-123',
    departureTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    arrivalTime: new Date(Date.now() + 3600000 + 45 * 60000).toISOString(),
    status: 'SCHEDULED',
    priceEGP: 65,
    availableSeats: 14,
    bookedSeats: 3,
    lockedSeats: [10], // seat 10 is locked
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: 'trip-2',
    routeId: MOCK_ROUTES[0],
    vehicleId: 'vehicle-123',
    driverId: 'driver-123',
    departureTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
    arrivalTime: new Date(Date.now() + 7200000 + 45 * 60000).toISOString(),
    status: 'SCHEDULED',
    priceEGP: 65,
    availableSeats: 14,
    bookedSeats: 12,
    lockedSeats: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const MOCK_BOOKINGS = [
  {
    _id: 'booking-1',
    userId: 'user-123',
    tripId: {
      _id: 'trip-1',
      departureTime: new Date(Date.now() + 3600000).toISOString(),
      routeId: MOCK_ROUTES[0],
      vehicleId: 'vehicle-123',
    },
    seatNumbers: [1, 2],
    pickupStopId: 'cp-1',
    dropoffStopId: 'cp-3',
    pickupCheckpoint: MOCK_ROUTES[0].checkpoints[0],
    status: 'CONFIRMED',
    paymentStatus: 'SUCCESS',
    amountEGP: 130,
    bookedAt: new Date(),
    qrVerificationToken: 'mock-qr-token-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function setupMockAPI(page: Page) {
  // Block and abort all external third-party requests (maps, fonts, CDNs) to prevent DNS/network timeouts
  await page.route(
    (url) => !url.host.includes('localhost') && !url.host.includes('127.0.0.1'),
    (route) => route.abort()
  );

  // Mock Geolocation to prevent getCurrentPosition from hanging in headless test environments
  await page.addInitScript(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition = (success, error) => {
        if (error) {
          error({
            code: 1,
            message: 'User denied Geolocation',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as any);
        }
      };
    }
  });


  // 1. Auth Profile Mocking
  await page.route('**/api/auth/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_USER }),
    });
  });

  // 2. Auth Login Mocking
  await page.route('**/api/auth/login', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = request.postDataJSON();
      if (payload && payload.email === 'passenger@dride.com' && payload.password === 'password123') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              user: MOCK_USER,
              accessToken: 'mock-jwt-token-123',
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Invalid credentials',
          }),
        });
      }
    }
  });

  // 3. Auth Register Mocking
  await page.route('**/api/auth/register', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = request.postDataJSON();
      if (payload && payload.email === 'exists@dride.com') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Email already exists',
          }),
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              user: {
                ...MOCK_USER,
                name: payload?.name || 'New User',
                email: payload?.email || 'new@dride.com',
                phone: payload?.phone || '01011112222',
              },
              accessToken: 'mock-jwt-token-new',
            },
          }),
        });
      }
    }
  });

  // 4. Routes Mocking
  await page.route('**/api/routes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_ROUTES }),
    });
  });

  // 5. Nearest Checkpoint Mocking
  await page.route('**/api/routes/*/nearest-checkpoint*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_ROUTES[0].checkpoints[0] }),
    });
  });

  // 6. Trips Search Mocking
  await page.route('**/api/trips/search*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_TRIPS }),
    });
  });

  // 7. Trip Details Mocking
  await page.route('**/api/trips/*', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/trips/search')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_TRIPS }),
      });
      return;
    }
    const tripId = url.split('/').pop()?.split('?')[0];
    const trip = MOCK_TRIPS.find((t) => t._id === tripId) || MOCK_TRIPS[0];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: trip }),
    });
  });

  // 8. Bookings Occupied Seats Mocking
  await page.route('**/api/bookings/occupied/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [2, 5, 8] }),
    });
  });

  // 9. Bookings List Mocking
  await page.route('**/api/bookings/my-bookings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_BOOKINGS }),
    });
  });

  // 10. Bookings Create Mocking
  await page.route('**/api/bookings', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = request.postDataJSON();
      const newBooking = {
        _id: 'booking-new-123',
        userId: 'user-123',
        tripId: payload?.tripId || 'trip-1',
        seatNumbers: payload?.seatNumbers || [1],
        pickupCheckpoint: payload?.pickupCheckpoint || MOCK_ROUTES[0].checkpoints[0],
        status: 'CONFIRMED', // Set to confirmed so it shows up in active trips
        paymentStatus: 'SUCCESS',
        amountEGP: 65 * (payload?.seatNumbers?.length || 1),
        bookedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: newBooking }),
      });
    }
  });

  // 11. Bookings Cancel Mocking
  await page.route(/\/api\/bookings\/.*\/cancel/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { success: true, status: 'CANCELLED' } }),
    });
  });

  // 12. Paymob Checkout Mocking
  await page.route('**/api/paymob/checkout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          redirectUrl: 'http://localhost:5173/payment/callback?status=success&bookingId=booking-new-123',
          iframeUrl: 'http://localhost:5173/payment/callback?status=success&bookingId=booking-new-123',
          orderId: 98765,
        },
      }),
    });
  });

  // 13. Support Submit Mocking
  await page.route('**/api/support/submit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { success: true } }),
    });
  });

  // 14. Booking Details Mocking
  await page.route(/\/api\/bookings\/[a-zA-Z0-9_-]+$/, async (route) => {
    const url = route.request().url();
    const bookingId = url.split('/').pop()?.split('?')[0];
    if (bookingId === 'my-bookings') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          _id: bookingId || 'booking-new-123',
          userId: 'user-123',
          tripId: MOCK_TRIPS[0],
          seatNumbers: [1],
          pickupStopId: 'cp-1',
          dropoffStopId: 'cp-3',
          pickupCheckpoint: MOCK_ROUTES[0].checkpoints[0],
          dropoffCheckpoint: MOCK_ROUTES[0].checkpoints[2],
          status: 'PENDING',
          paymentStatus: 'PENDING',
          amountEGP: 65,
          bookedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }),
    });
  });

  // 15. Paymob Features Mocking
  await page.route('**/api/paymob/features', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          allowCashOnDelivery: true,
        }
      }),
    });
  });
}
