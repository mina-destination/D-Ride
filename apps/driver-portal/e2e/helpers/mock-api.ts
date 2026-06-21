import { Page } from '@playwright/test';

export const MOCK_DRIVER_USER = {
  _id: 'driver-123',
  id: 'driver-123',
  name: 'Captain Ahmed',
  email: 'driver@dride.com',
  phone: '01011112222',
  role: 'DRIVER',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_ROUTES = [
  {
    _id: 'route-1',
    name: 'Maadi to Smart Village',
    nameAr: 'المعادي إلى القرية الذكية',
    checkpoints: [
      {
        _id: 'cp-1', name: 'Maadi Square', nameAr: 'ميدان المعادي',
        type: 'START', order: 1,
        location: { type: 'Point', coordinates: [31.25, 29.96] },
      },
      {
        _id: 'cp-2', name: 'Ring Road', nameAr: 'الطريق الدائري',
        type: 'CHECKPOINT', order: 2,
        location: { type: 'Point', coordinates: [31.15, 30.01] },
      },
      {
        _id: 'cp-3', name: 'Smart Village Gate', nameAr: 'بوابة القرية الذكية',
        type: 'END', order: 3,
        location: { type: 'Point', coordinates: [30.78, 30.08] },
      },
    ],
    distanceKm: 35,
    estimatedDurationMinutes: 45,
  },
];

export const MOCK_TRIPS = [
  {
    _id: 'trip-1',
    id: 'trip-1',
    routeId: MOCK_ROUTES[0],
    vehicleId: { _id: 'vehicle-1', model: 'Toyota HiAce', plateNumber: 'DR-20', capacity: 14 },
    driverId: MOCK_DRIVER_USER,
    departureTime: new Date(Date.now() + 3600000).toISOString(),
    arrivalTime: new Date(Date.now() + 7200000).toISOString(),
    status: 'SCHEDULED',
    priceEGP: 65,
    availableSeats: 14,
    bookedSeats: 5,
    lockedSeats: [14],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'trip-2',
    id: 'trip-2',
    routeId: MOCK_ROUTES[0],
    vehicleId: { _id: 'vehicle-1', model: 'Toyota HiAce', plateNumber: 'DR-20', capacity: 14 },
    driverId: MOCK_DRIVER_USER,
    departureTime: new Date(Date.now() - 86400000).toISOString(),
    arrivalTime: new Date(Date.now() - 86400000 + 3600000).toISOString(),
    status: 'COMPLETED',
    priceEGP: 65,
    availableSeats: 14,
    bookedSeats: 10,
    lockedSeats: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_BOOKINGS = [
  {
    _id: 'booking-1',
    userId: { _id: 'user-123', name: 'Test Passenger', email: 'passenger@dride.com', phone: '01012345678' },
    tripId: 'trip-1',
    seatNumbers: [1, 2],
    pickupCheckpoint: MOCK_ROUTES[0].checkpoints[0],
    dropoffCheckpoint: MOCK_ROUTES[0].checkpoints[2],
    status: 'CONFIRMED',
    paymentStatus: 'SUCCESS',
    amountEGP: 130,
    boardingNumber: null,
    bookedAt: new Date().toISOString(),
  },
  {
    _id: 'booking-2',
    userId: { _id: 'user-456', name: 'Sara Ali', email: 'sara@dride.com', phone: '01033334444' },
    tripId: 'trip-1',
    seatNumbers: [3],
    pickupCheckpoint: MOCK_ROUTES[0].checkpoints[1],
    dropoffCheckpoint: MOCK_ROUTES[0].checkpoints[2],
    status: 'CONFIRMED',
    paymentStatus: 'SUCCESS',
    amountEGP: 65,
    boardingNumber: null,
    bookedAt: new Date().toISOString(),
  },
];

export async function setupDriverMockAPI(page: Page) {
  // Block external requests
  await page.route(
    (url) => !url.host.includes('localhost') && !url.host.includes('127.0.0.1'),
    (route) => route.abort()
  );

  // Mock Geolocation
  await page.addInitScript(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition = (success) => {
        success({
          coords: {
            latitude: 30.01,
            longitude: 31.15,
            altitude: null,
            accuracy: 10,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as any);
      };
      navigator.geolocation.watchPosition = (success) => {
        success({
          coords: {
            latitude: 30.01,
            longitude: 31.15,
            altitude: null,
            accuracy: 10,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as any);
        return 1;
      };
    }
  });

  // Auth Profile
  await page.route('**/api/auth/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_DRIVER_USER }),
    });
  });

  // Auth Login
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: MOCK_DRIVER_USER,
          accessToken: 'mock-driver-jwt-token',
        },
      }),
    });
  });

  // Driver's trips (my-trips)
  await page.route('**/api/trips/my-trips', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_TRIPS }),
    });
  });

  // Trip by ID
  await page.route(/\/api\/trips\/[a-zA-Z0-9_-]+$/, async (route) => {
    const url = route.request().url();
    if (url.includes('my-trips')) {
      await route.fallback();
      return;
    }
    const tripId = url.split('/').pop()?.split('?')[0];
    const trip = MOCK_TRIPS.find(t => t._id === tripId) || MOCK_TRIPS[0];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: trip }),
    });
  });

  // Trip status update
  await page.route(/\/api\/trips\/[a-zA-Z0-9_-]+\/status$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ...MOCK_TRIPS[0], status: 'BOARDING' } }),
    });
  });

  // Arrived checkpoints list
  await page.route(/\/api\/trips\/[a-zA-Z0-9_-]+\/arrived-checkpoints$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  // Bookings for a trip (occupied seats / manifest)
  await page.route(/\/api\/bookings/, async (route) => {
    const url = route.request().url();
    if (url.includes('/occupied/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [1, 2, 3] }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_BOOKINGS }),
      });
    }
  });

  // Vehicle location updates
  await page.route('**/api/vehicles/location', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { success: true } }),
    });
  });

  // Reviews
  await page.route('**/api/reviews/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { averageRating: 4.8, totalReviews: 24, reviews: [] } }),
    });
  });

  // Routes
  await page.route('**/api/routes', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_ROUTES }),
    });
  });
}
