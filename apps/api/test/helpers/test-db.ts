import { PrismaClient } from '@prisma/client';

const TEST_PREFIX = 'e2e_test_';

export async function cleanupTestData(prisma: PrismaClient) {
  // Delete in dependency order to respect foreign keys
  await prisma.review.deleteMany({
    where: {
      OR: [
        { user: { email: { startsWith: TEST_PREFIX } } },
        { trip: { route: { name: { startsWith: 'E2E_TEST_' } } } },
        { trip: { route: { name: { startsWith: TEST_PREFIX } } } },
      ],
    },
  });

  await prisma.transaction.deleteMany({
    where: {
      OR: [
        { user: { email: { startsWith: TEST_PREFIX } } },
        { booking: { trip: { route: { name: { startsWith: 'E2E_TEST_' } } } } },
        { booking: { trip: { route: { name: { startsWith: TEST_PREFIX } } } } },
      ],
    },
  });

  await prisma.booking.deleteMany({
    where: {
      OR: [
        { user: { email: { startsWith: TEST_PREFIX } } },
        { trip: { route: { name: { startsWith: 'E2E_TEST_' } } } },
        { trip: { route: { name: { startsWith: TEST_PREFIX } } } },
      ],
    },
  });

  await prisma.supportTicket.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });

  await prisma.trip.deleteMany({
    where: {
      OR: [
        { route: { name: { startsWith: 'E2E_TEST_' } } },
        { route: { name: { startsWith: TEST_PREFIX } } },
      ],
    },
  });

  await prisma.route.deleteMany({
    where: {
      OR: [
        { name: { startsWith: 'E2E_TEST_' } },
        { name: { startsWith: TEST_PREFIX } },
      ],
    },
  });

  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  });
}
