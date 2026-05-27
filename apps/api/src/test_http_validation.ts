import axios from 'axios';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const route = await prisma.route.findFirst({
      where: { name: { contains: 'Alexandria' } }
    });
    const vehicle = await prisma.vehicle.findFirst({
      where: { model: { contains: 'Movano' } }
    });
    const driver = await prisma.user.findFirst({
      where: { name: { contains: 'Ahmed' } }
    });

    console.log('Found Route:', route?.id, route?.name);
    console.log('Found Vehicle:', vehicle?.id, vehicle?.model);
    console.log('Found Driver:', driver?.id, driver?.name);

    if (!route) {
      console.log('Alexandria route not found.');
      return;
    }

    console.log('Logging in as owner...');
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'owner@dride.com',
      password: 'owner123'
    });
    const token = loginRes.data.data.accessToken;

    const client = axios.create({
      baseURL: 'http://localhost:3000/api',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const payload = {
      routeId: route.id,
      vehicleId: vehicle?.id || null,
      driverId: driver?.id || null,
      departureTime: new Date('2026-05-29T00:00:00.000Z').toISOString(), // May 29, 2026
      status: 'SCHEDULED',
      lockedSeats: []
    };

    console.log('Posting exact payload...');
    try {
      const res = await client.post('/trips', payload);
      console.log('Success:', res.data);
    } catch (err: any) {
      console.log('Failed with status:', err.response?.status);
      console.log('Error details:', JSON.stringify(err.response?.data, null, 2));
    }
  } catch (error: any) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
