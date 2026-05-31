const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tickets = await prisma.supportTicket.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log('TICKETS IN DB:', JSON.stringify(tickets, null, 2));
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
