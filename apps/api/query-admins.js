const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION']
      }
    }
  });
  console.log('ADMIN USERS:', JSON.stringify(users, null, 2));

  const permissions = await prisma.rolePermission.findMany();
  console.log('ROLE PERMISSIONS:', JSON.stringify(permissions, null, 2));

  await prisma.$disconnect();
}

main();
