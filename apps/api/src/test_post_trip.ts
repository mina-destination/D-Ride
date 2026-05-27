import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const route = await prisma.route.findFirst();
    if (!route) {
      console.log('No routes found.');
      return;
    }
    
    // Simulate a payload with no vehicle or driver (optional fields)
    const payload = {
      routeId: route.id,
      departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
      status: 'SCHEDULED',
      lockedSeats: [14],
    };

    console.log('Attempting to create trip with payload:', payload);
    
    // Call trips.service directly to see what validation it performs
    // or how it behaves
    const { TripsService } = require('./trips/trips.service');
    const service = new TripsService(prisma);
    const result = await service.create(payload);
    console.log('Trip successfully created:', result);
  } catch (error: any) {
    console.error('Error during trip creation simulation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
