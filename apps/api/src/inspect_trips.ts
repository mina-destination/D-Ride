import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const trips = await prisma.trip.findMany();
    if (trips.length === 0) {
      console.log('No trips found to update.');
      return;
    }
    const firstTrip = trips[0];
    console.log(`Initial lockedSeats for Trip ${firstTrip.id}:`, firstTrip.lockedSeats);

    // Toggle lockedSeats
    const isLocked = firstTrip.lockedSeats && (firstTrip.lockedSeats as any).includes(14);
    const nextLocked = isLocked ? [] : [14];
    
    console.log(`Updating to:`, nextLocked);
    const updatedTrip = await prisma.trip.update({
      where: { id: firstTrip.id },
      data: { lockedSeats: nextLocked },
    });
    console.log(`Updated lockedSeats for Trip ${firstTrip.id}:`, updatedTrip.lockedSeats);
  } catch (error) {
    console.error('Error during update test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
