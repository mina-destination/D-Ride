import { test, expect } from '@playwright/test';

// Mocks for E2E flow
const MOCK_ADMIN_USER = {
  _id: 'admin-123',
  id: 'admin-123',
  name: 'System Owner',
  email: 'owner@dride.com',
  phone: '01000000000',
  role: 'OWNER',
  permissions: [
    'dashboard', 'routes', 'trips', 'vehicles', 'drivers', 'bookings', 'payments', 'passengers', 'crm', 'settings'
  ],
};

const MOCK_DRIVER_USER = {
  _id: 'driver-123',
  id: 'driver-123',
  name: 'Captain Ahmed',
  email: 'driver@dride.com',
  phone: '01011112222',
  role: 'DRIVER',
};

const MOCK_PASSENGER_USER = {
  _id: 'user-123',
  id: 'user-123',
  name: 'Test Passenger',
  email: 'passenger@dride.com',
  phone: '01012345678',
  role: 'PASSENGER',
};

const MOCK_ROUTES = [
  {
    _id: 'route-1',
    name: 'Maadi to Smart Village',
    nameAr: 'المعادي إلى القرية الذكية',
    checkpoints: [
      { _id: 'cp-1', name: 'Maadi Square', nameAr: 'ميدان المعادي', location: { type: 'Point', coordinates: [31.25, 29.96] }, order: 1 },
      { _id: 'cp-2', name: 'Ring Road', nameAr: 'الطريق الدائري', location: { type: 'Point', coordinates: [31.15, 30.01] }, order: 2 },
      { _id: 'cp-3', name: 'Smart Village Gate', nameAr: 'بوابة القرية الذكية', location: { type: 'Point', coordinates: [30.78, 30.08] }, order: 3 },
    ],
  }
];

const MOCK_TRIPS = [
  {
    _id: 'trip-1',
    routeId: MOCK_ROUTES[0],
    vehicleId: 'vehicle-123',
    driverId: 'driver-123',
    departureTime: new Date(Date.now() + 3600000).toISOString(),
    arrivalTime: new Date(Date.now() + 7200000).toISOString(),
    status: 'SCHEDULED',
    priceEGP: 65,
    availableSeats: 14,
    bookedSeats: 0,
    lockedSeats: [],
  }
];

// Helper to setup console logging and api routing mocks for any dashboard page
async function setupConsoleAndAPIMocks(page: any, role: 'OWNER' | 'DRIVER' | 'PASSENGER') {
  // Capture console logs from browser page
  page.on('console', (msg: any) => {
    console.log(`[BROWSER CONSOLE - ${role} PORTAL - ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Intercept backend API requests
  await page.route('**/api/auth/profile', async (route: any) => {
    const user = role === 'OWNER' ? MOCK_ADMIN_USER : (role === 'DRIVER' ? MOCK_DRIVER_USER : MOCK_PASSENGER_USER);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: user }),
    });
  });

  await page.route('**/api/auth/login', async (route: any) => {
    const user = role === 'OWNER' ? MOCK_ADMIN_USER : (role === 'DRIVER' ? MOCK_DRIVER_USER : MOCK_PASSENGER_USER);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user,
          accessToken: `mock-jwt-token-${role}`,
        }
      }),
    });
  });

  await page.route(/\/api\/routes(\?.*)?$/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_ROUTES }),
    });
  });

  await page.route('**/api/trips', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_TRIPS }),
    });
  });

  await page.route('**/api/trips/search*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_TRIPS }),
    });
  });

  await page.route('**/api/routes/smart-search*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          trip: MOCK_TRIPS[0],
          pickupCheckpoint: { ...MOCK_ROUTES[0].checkpoints[1], distanceMeters: 0, index: 1, localizedDepartureTime: new Date().toISOString() },
          dropoffCheckpoint: { ...MOCK_ROUTES[0].checkpoints[2], distanceMeters: 0, index: 2, localizedArrivalTime: new Date().toISOString() },
          amountEGP: 65,
          totalWalkingDistance: 0
        }]
      }),
    });
  });

  await page.route('**/api/trips/*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_TRIPS[0] }),
    });
  });

  await page.route('**/api/bookings/occupied/*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  await page.route(/\/api\/users(\?.*)?$/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [MOCK_PASSENGER_USER] }),
    });
  });

  await page.route('**/api/vehicles', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  await page.route('**/api/bookings', async (route: any) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            _id: 'booking-new-e2e',
            userId: 'user-123',
            tripId: MOCK_TRIPS[0],
            seatNumbers: [1],
            pickupCheckpoint: MOCK_ROUTES[0].checkpoints[1], // Ring Road
            dropoffCheckpoint: MOCK_ROUTES[0].checkpoints[2], // Smart Village Gate
            status: 'CONFIRMED',
            paymentStatus: 'SUCCESS',
            amountEGP: 65,
            bookedAt: new Date(),
          }
        }),
      });
    } else {
      // GET request
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              _id: 'booking-new-e2e',
              userId: MOCK_PASSENGER_USER,
              tripId: MOCK_TRIPS[0],
              seatNumbers: [1],
              pickupCheckpoint: MOCK_ROUTES[0].checkpoints[1], // Ring Road
              dropoffCheckpoint: MOCK_ROUTES[0].checkpoints[2], // Smart Village Gate
              status: 'CONFIRMED',
              paymentStatus: 'SUCCESS',
              amountEGP: 65,
              bookedAt: new Date(),
            }
          ]
        }),
      });
    }
  });

  await page.route('**/api/bookings/booking-new-e2e', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          _id: 'booking-new-e2e',
          userId: 'user-123',
          tripId: MOCK_TRIPS[0],
          seatNumbers: [1],
          pickupCheckpoint: MOCK_ROUTES[0].checkpoints[1], // Ring Road
          dropoffCheckpoint: MOCK_ROUTES[0].checkpoints[2], // Smart Village Gate
          status: 'CONFIRMED',
          paymentStatus: 'SUCCESS',
          amountEGP: 65,
          bookedAt: new Date(),
        }
      }),
    });
  });

  await page.route('**/api/paymob/checkout', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          redirectUrl: 'http://localhost:5173/payment/callback?success=true&bookingId=booking-new-e2e&amount=65',
        }
      }),
    });
  });

  await page.route('**/api/paymob/features', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { allowCashOnDelivery: false } }),
    });
  });

  await page.route('**/api/paymob/confirm', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/partners', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  await page.route('**/api/bookings/my-bookings', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  await page.route('**/api/settings', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          supportEmail: 'support@dride.com',
          supportPhone: '+20 100 123 4567',
        }
      }),
    });
  });
}

test.describe('D-Ride Multiview Dashboard Console Flow', () => {

  test('Step 1: Admin Dashboard E2E Navigation & Checks', async ({ page }) => {
    await setupConsoleAndAPIMocks(page, 'OWNER');
    
    // Go to Admin login
    await page.goto('http://localhost:5174/login');
    await expect(page.locator('h1.login-title')).toContainText('Admin');

    // Fill credentials & Sign in
    await page.fill('#email', 'owner@dride.com');
    await page.fill('#password', 'owner123');
    await page.click('button[type="submit"]');

    // Verify redirect to admin homepage/dashboard
    await page.waitForURL('http://localhost:5174/');
    console.log('[E2E-INFO] Admin logged in successfully.');
  });

  test('Step 2: Passenger Portal E2E Route Search, Seat Selection & Checkout', async ({ page }) => {
    await setupConsoleAndAPIMocks(page, 'PASSENGER');

    // Pre-seed local token for passenger portal
    await page.goto('http://localhost:5173/');
    await page.evaluate((user) => {
      localStorage.setItem('dride_token', 'mock-jwt-token-passenger');
      localStorage.setItem('dride_user', JSON.stringify(user));
    }, MOCK_PASSENGER_USER);

    // Search for trip
    await page.goto('http://localhost:5173/');
    await expect(page.locator('.hero-title')).toBeVisible();

    const fromInput = page.locator('input[placeholder="Search boarding stop..."]');
    await fromInput.fill('Ring Road');
    await page.locator('.custom-dropdown-menu .custom-dropdown-item:has-text("Ring Road")').click();

    const toInput = page.locator('input[placeholder="Search destination stop..."]');
    await toInput.fill('Smart Village Gate');
    await page.locator('.custom-dropdown-menu .custom-dropdown-item:has-text("Smart Village Gate")').click();

    // Search trips
    await page.click('#search-trips-btn');
    await page.waitForURL(new RegExp('\\/search\\?pickupLat='));

    // Check high-contrast trip cards
    await expect(page.locator('.trip-card')).toBeVisible();

    // Click "Book Seat" on the first scheduled trip card
    await page.click('button:has-text("Book Seat")');
    await page.waitForURL(new RegExp('\\/checkout\\?tripId='));

    // Verify 14-seater Toyota HiAce grid layout and select Seat #1
    await expect(page.locator('.bus-cabin')).toBeVisible();
    const seat1 = page.locator('.bus-seat').filter({ hasText: /^1$/ });
    await seat1.click();
    await expect(seat1).toHaveClass(/selected/);

    // Ensure segment summary, leg total and checkpoints display high-contrast styling details correctly
    await expect(page.locator('text=Total Cost >> ..')).toContainText('65 EGP');

    // Click checkout confirm button
    await page.click('.auth-button');
    await page.waitForURL(new RegExp('\\/payment\\?bookingId='));

    // Confirm booking via card (Card is active by default)
    await page.click('button:has-text("Pay 65 EGP via Paymob")');
    await page.click('button:has-text("View My Trips")');

    // Should redirect to My Trips page
    await page.waitForURL('http://localhost:5173/my-trips');
    console.log('[E2E-INFO] Passenger booking checkout workflow verified successfully.');
  });

  test('Step 3: Driver Portal Command Center Checks', async ({ page }) => {
    await setupConsoleAndAPIMocks(page, 'DRIVER');

    // Go to Driver login page
    await page.goto('http://localhost:5175/login');
    
    // Fill credentials & Sign in
    await page.fill('input[type="email"]', 'driver@dride.com');
    await page.fill('input[type="password"]', 'driver123');
    await page.click('button[type="submit"]');

    // Should redirect to Trips view page
    await page.waitForURL('http://localhost:5175/trips');
    console.log('[E2E-INFO] Driver command center login verified successfully.');
  });

});
