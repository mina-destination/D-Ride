import { Page } from '@playwright/test';

export const MOCK_ADMIN_USER = {
  _id: 'admin-123',
  id: 'admin-123',
  name: 'System Owner',
  email: 'owner@dride.com',
  phone: '01000000000',
  role: 'OWNER',
  permissions: [
    'dashboard', 'routes', 'trips', 'vehicles', 'drivers',
    'bookings', 'payments', 'passengers', 'crm', 'settings'
  ],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_ROUTES = [
  {
    _id: 'route-1',
    id: 'route-1',
    name: 'Maadi to Smart Village',
    path: {
      type: 'LineString',
      coordinates: [[31.25, 29.96], [31.15, 30.01], [30.78, 30.08]],
    },
    coverImage: '',
    checkpoints: [
      {
        _id: 'cp-1', name: 'Maadi Square', nameAr: 'ميدان المعادي',
        type: 'START', order: 1, bufferTimeMinutes: 5, geofenceRadiusMeters: 200,
        location: { type: 'Point', coordinates: [31.25, 29.96] },
      },
      {
        _id: 'cp-2', name: 'Ring Road', nameAr: 'الطريق الدائري',
        type: 'CHECKPOINT', order: 2, bufferTimeMinutes: 3, geofenceRadiusMeters: 150,
        location: { type: 'Point', coordinates: [31.15, 30.01] },
      },
      {
        _id: 'cp-3', name: 'Smart Village Gate', nameAr: 'بوابة القرية الذكية',
        type: 'END', order: 3, bufferTimeMinutes: 0, geofenceRadiusMeters: 200,
        location: { type: 'Point', coordinates: [30.78, 30.08] },
      },
    ],
    distanceKm: 35,
    estimatedDurationMinutes: 45,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_VEHICLES = [
  {
    _id: 'vehicle-1',
    id: 'vehicle-1',
    make: 'Toyota',
    model: 'HiAce',
    licensePlate: 'DR-20',
    capacity: 14,
    type: 'SHUTTLE_BUS',
    driverId: 'driver-1',
    driver: { _id: 'driver-1', name: 'Captain Ahmed', email: 'driver@dride.com' },
    status: 'ACTIVE',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_DRIVERS = [
  {
    _id: 'driver-1',
    id: 'driver-1',
    name: 'Captain Ahmed',
    email: 'driver@dride.com',
    phone: '01011112222',
    role: 'DRIVER',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_TRIPS = [
  {
    _id: 'trip-1',
    id: 'trip-1',
    routeId: MOCK_ROUTES[0],
    vehicleId: MOCK_VEHICLES[0],
    driverId: MOCK_DRIVERS[0],
    departureTime: new Date(Date.now() + 3600000).toISOString(),
    arrivalTime: new Date(Date.now() + 7200000).toISOString(),
    status: 'SCHEDULED',
    priceEGP: 65,
    availableSeats: 14,
    bookedSeats: 3,
    lockedSeats: [14],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_BOOKINGS = [
  {
    _id: 'booking-1',
    id: 'booking-1',
    userId: { _id: 'user-123', name: 'Test Passenger', email: 'passenger@dride.com', phone: '01012345678' },
    tripId: MOCK_TRIPS[0],
    seatNumbers: [1, 2],
    pickupCheckpoint: MOCK_ROUTES[0].checkpoints[0],
    dropoffCheckpoint: MOCK_ROUTES[0].checkpoints[2],
    status: 'CONFIRMED',
    paymentStatus: 'SUCCESS',
    amountEGP: 130,
    bookedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_PASSENGERS = [
  {
    _id: 'user-123',
    id: 'user-123',
    name: 'Test Passenger',
    email: 'passenger@dride.com',
    phone: '01012345678',
    role: 'PASSENGER',
    isActive: true,
    crmNotes: [],
    walletBalance: 250,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_TRANSACTIONS = [
  {
    _id: 'tx-1',
    id: 'tx-1',
    bookingId: 'booking-1',
    userId: { _id: 'user-123', name: 'Test Passenger' },
    amountEGP: 130,
    status: 'SUCCESS',
    paymentMethod: 'CARD',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_TICKETS = [
  {
    _id: 'ticket-1',
    id: 'ticket-1',
    userId: { _id: 'user-123', name: 'Test Passenger', email: 'passenger@dride.com' },
    name: 'Test Passenger',
    email: 'passenger@dride.com',
    phone: '01012345678',
    subject: 'Double billing issue',
    message: 'I was charged twice for booking-1.',
    status: 'OPEN',
    replies: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_PARTNERS = [
  {
    _id: 'partner-1',
    id: 'partner-1',
    name: 'Cairo University',
    logoUrl: 'https://via.placeholder.com/120',
    websiteUrl: 'https://cu.edu.eg',
    isActive: true,
  },
];

export const MOCK_ADMINS = [
  MOCK_ADMIN_USER,
  {
    _id: 'admin-2',
    id: 'admin-2',
    name: 'Operations Manager',
    email: 'ops@dride.com',
    phone: '01099998888',
    role: 'OPERATION',
    permissions: ['routes', 'trips', 'vehicles', 'drivers', 'bookings'],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const MOCK_ROLE_PERMISSIONS = {
  OPERATION: ['routes', 'trips', 'vehicles', 'drivers', 'bookings'],
  ADMIN: ['routes', 'trips', 'vehicles', 'drivers', 'bookings', 'payments', 'passengers'],
  SUPER_ADMIN: ['dashboard', 'routes', 'trips', 'vehicles', 'drivers', 'bookings', 'payments', 'passengers', 'crm', 'settings'],
};

export const MOCK_DASHBOARD_STATS = {
  totalBookings: 125,
  totalRevenue: 8125,
  activeTrips: 4,
  totalPassengers: 67,
  recentBookings: MOCK_BOOKINGS,
};

export async function setupAdminMockAPI(page: Page) {
  // Block external requests
  await page.route(
    (url) => !url.host.includes('localhost') && !url.host.includes('127.0.0.1'),
    (route) => route.abort()
  );

  // Auth Profile
  await page.route('**/api/auth/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_ADMIN_USER }),
    });
  });

  // Auth Login
  await page.route('**/api/auth/login', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: MOCK_ADMIN_USER,
            accessToken: 'mock-admin-jwt-token',
          },
        }),
      });
    }
  });

  // Routes
  await page.route('**/api/routes*', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { ...MOCK_ROUTES[0], _id: 'route-new' } }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_ROUTES }),
      });
    }
  });

  // Routes by ID
  await page.route(/\/api\/routes\/[a-zA-Z0-9_-]+$/, async (route) => {
    const request = route.request();
    if (request.method() === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { success: true } }) });
    } else if (request.method() === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_ROUTES[0] }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_ROUTES[0] }) });
    }
  });

  // Trips
  await page.route('**/api/trips*', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { ...MOCK_TRIPS[0], _id: 'trip-new' } }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_TRIPS }),
      });
    }
  });

  // Trip search
  await page.route('**/api/trips/search*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_TRIPS }),
    });
  });

  // Trips by ID
  await page.route(/\/api\/trips\/[a-zA-Z0-9_-]+$/, async (route) => {
    const request = route.request();
    if (request.method() === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { success: true } }) });
    } else if (request.method() === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_TRIPS[0] }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_TRIPS[0] }) });
    }
  });

  // Trip status update
  await page.route(/\/api\/trips\/[a-zA-Z0-9_-]+\/status$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ...MOCK_TRIPS[0], status: 'BOARDING' } }) });
  });

  // Vehicles
  await page.route('**/api/vehicles', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { ...MOCK_VEHICLES[0], _id: 'vehicle-new' } }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_VEHICLES }) });
    }
  });

  // Vehicles by ID
  await page.route(/\/api\/vehicles\/[a-zA-Z0-9_-]+$/, async (route) => {
    const request = route.request();
    if (request.method() === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { success: true } }) });
    } else if (request.method() === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_VEHICLES[0] }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_VEHICLES[0] }) });
    }
  });

  // Users (all roles: passengers, drivers, admins)
  await page.route(/\/api\/users(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { ...MOCK_PASSENGERS[0], _id: 'user-new' } }) });
    } else {
      const url = request.url();
      const params = new URL(url).searchParams;
      const role = params.get('role');
      if (role === 'DRIVER') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_DRIVERS }) });
      } else if (role && ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION'].includes(role)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_ADMINS }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [...MOCK_PASSENGERS, ...MOCK_DRIVERS, ...MOCK_ADMINS] }) });
      }
    }
  });

  // Users by ID
  await page.route(/\/api\/users\/[a-zA-Z0-9_-]+$/, async (route) => {
    const request = route.request();
    if (request.method() === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { success: true } }) });
    } else if (request.method() === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_PASSENGERS[0] }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_PASSENGERS[0] }) });
    }
  });

  // User notes
  await page.route(/\/api\/users\/[a-zA-Z0-9_-]+\/notes$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { success: true } }) });
  });

  // Role permissions
  await page.route('**/api/users/role-permissions', async (route) => {
    const request = route.request();
    if (request.method() === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { success: true } }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_ROLE_PERMISSIONS }) });
    }
  });

  // Bookings
  await page.route('**/api/bookings', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_BOOKINGS }) });
  });

  // Bookings occupied
  await page.route('**/api/bookings/occupied/*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [1, 2] }) });
  });

  // Bookings by ID
  await page.route(/\/api\/bookings\/[a-zA-Z0-9_-]+$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_BOOKINGS[0] }) });
  });

  // Transactions / payments
  await page.route('**/api/payments*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_TRANSACTIONS }) });
  });

  // Support tickets
  await page.route('**/api/support/tickets', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_TICKETS }) });
  });

  // Support ticket by ID (resolve, reply, messages)
  await page.route(/\/api\/support\/tickets\/[a-zA-Z0-9_-]+/, async (route) => {
    const request = route.request();
    if (request.method() === 'PUT') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { ...MOCK_TICKETS[0], status: 'RESOLVED' } }) });
    } else if (request.method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { message: 'Reply sent', senderId: 'admin-123' } }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    }
  });

  // Partners
  await page.route('**/api/partners', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { ...MOCK_PARTNERS[0], _id: 'partner-new' } }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_PARTNERS }) });
    }
  });

  // Partners all (for admin)
  await page.route('**/api/partners/all', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_PARTNERS }) });
  });

  // Dashboard stats (mock endpoint for summary data)
  await page.route('**/api/dashboard*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: MOCK_DASHBOARD_STATS }) });
  });

  // Paymob features
  await page.route('**/api/paymob/features', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { allowCashOnDelivery: true } }) });
  });

  // Reviews & ratings
  await page.route(/\/api\/reviews\/driver\/[a-zA-Z0-9_-]+\/list$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            _id: 'rev-1',
            userName: 'Ahmed Aly',
            userAvatar: '',
            rating: 5,
            comment: 'Great driving, arrived on time!',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            _id: 'rev-2',
            userName: 'Sara Hassan',
            userAvatar: '',
            rating: 4,
            comment: 'Smooth ride.',
            createdAt: new Date(Date.now() - 172800000).toISOString(),
          }
        ]
      })
    });
  });

  await page.route(/\/api\/reviews\/driver\/[a-zA-Z0-9_-]+$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          averageRating: 4.8,
          totalReviews: 2
        }
      })
    });
  });
}
