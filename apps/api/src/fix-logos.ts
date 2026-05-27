import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  console.log('Finding partners to update...');

  // Update Paymob Egypt
  const paymob = await prisma.partner.updateMany({
    where: {
      name: { contains: 'Paymob', mode: 'insensitive' },
      logoUrl: { contains: 'brandfetch' }
    },
    data: {
      logoUrl: 'https://placehold.co/400x400/26272b/fff?text=Paymob'
    }
  });
  console.log(`Updated Paymob: ${paymob.count} records`);

  // Update Orange Egypt
  const orange = await prisma.partner.updateMany({
    where: {
      name: { contains: 'Orange', mode: 'insensitive' },
      logoUrl: { contains: 'brandfetch' }
    },
    data: {
      logoUrl: 'https://placehold.co/400x400/26272b/fff?text=Orange'
    }
  });
  console.log(`Updated Orange: ${orange.count} records`);

  // Update Vodafone Cash
  const vodafone = await prisma.partner.updateMany({
    where: {
      name: { contains: 'Vodafone', mode: 'insensitive' },
      logoUrl: { contains: 'brandfetch' }
    },
    data: {
      logoUrl: 'https://placehold.co/400x400/26272b/fff?text=Vodafone'
    }
  });
  console.log(`Updated Vodafone: ${vodafone.count} records`);

  console.log('All done!');
  await app.close();
}

run().catch(err => {
  console.error('Error running fix-logos:', err);
  process.exit(1);
});
