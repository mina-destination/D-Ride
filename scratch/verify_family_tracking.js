const http = require('http');

async function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Status: ${res.statusCode}, Body: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  try {
    console.log('1. Logging in as Passenger (Hassan)...');
    const loginRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'hassan@dride.com',
      password: 'dride123'
    });

    const passengerToken = loginRes.data.accessToken;
    console.log('Login successful. Token acquired.');

    console.log('2. Fetching Hassan\'s bookings...');
    const bookingsRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings/my-bookings',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${passengerToken}` }
    });

    const bookings = bookingsRes.data || [];
    console.log(`Found ${bookings.length} bookings for Hassan.`);

    let testBooking = bookings.find(b => b.status === 'CONFIRMED' || b.status === 'BOARDED');
    
    if (!testBooking) {
      console.log('No active booking found. Creating a test booking via Admin...');
      console.log('Logging in as Admin...');
      const adminLoginRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        email: 'admin@dride.com',
        password: 'admin123'
      });
      const adminToken = adminLoginRes.data.accessToken;

      console.log('Fetching routes...');
      const routesRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/routes',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const route = routesRes.data[0];
      if (!route) throw new Error('No routes seeded.');
      const checkpoints = route.checkpoints || [];
      const pickupStopId = checkpoints[0]?.name || 'Start';
      const dropoffStopId = checkpoints[checkpoints.length - 1]?.name || 'End';

      console.log('Creating a test trip...');
      const depTime = new Date();
      depTime.setHours(depTime.getHours() + 1);
      const tripRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/trips',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      }, {
        routeId: route._id || route.id,
        departureTime: depTime.toISOString(),
        priceEGP: 100,
        premiumSeatSurcharge: 20,
        availableSeats: 14
      });
      const tripId = tripRes.data._id || tripRes.data.id;

      console.log('Booking the trip as Hassan...');
      const bookingRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/bookings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${passengerToken}`
        }
      }, {
        userId: loginRes.data.user.id,
        tripId: tripId,
        seatNumbers: [3],
        pickupStopId,
        dropoffStopId,
        paymentMethod: 'WALLET'
      });
      testBooking = bookingRes.data;
      console.log(`Created test booking: ${testBooking.id || testBooking._id}`);
    } else {
      console.log(`Using existing booking: ${testBooking.id || testBooking._id}`);
    }

    const ticketCode = testBooking.id || testBooking._id;

    console.log(`3. Calling /api/bookings/track-by-code/${ticketCode} with authorization...`);
    const trackingRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/bookings/track-by-code/${ticketCode}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${passengerToken}` }
    });

    console.log('Endpoint response successfully received!');
    console.log('Response properties:', Object.keys(trackingRes));
    console.log('Data details:');
    console.log(' - Booking ID:', trackingRes.data.booking?.id || trackingRes.data.booking?._id);
    console.log(' - Trip ID:', trackingRes.data.booking?.tripId);
    console.log(' - Vehicle details:', trackingRes.data.booking?.trip?.vehicle || 'Not present on nested trip');
    console.log(' - Live Location:', trackingRes.data.liveLocation);

    if (!trackingRes.data.booking) {
      throw new Error('Response data should contain the booking info.');
    }
    
    console.log('✅ track-by-code API check passed successfully!');
  } catch (error) {
    console.error('❌ Family tracking API validation failed:', error);
    process.exit(1);
  }
}

run();
