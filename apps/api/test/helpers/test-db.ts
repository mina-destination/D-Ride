import { PrismaClient } from '@prisma/client';

const TEST_PREFIX = 'e2e_test_';

export async function cleanupTestData(prisma: PrismaClient) {
  // Delete in dependency order to respect foreign keys
  await prisma.review.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });
  await prisma.transaction.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });
  await prisma.booking.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });
  await prisma.supportTicket.deleteMany({
    where: { user: { email: { startsWith: TEST_PREFIX } } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  });
}
