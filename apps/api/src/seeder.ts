import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma/prisma.service';
import { Role, TripStatus } from '@prisma/client';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  console.log('Clearing existing data (in dependency order)...');
  await prisma.transaction.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.liveVehicleLocation.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.route.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding Admin User...');
  const adminEmail = 'admin@dride.com';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    admin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: adminEmail,
        phone: '+201000000000',
        password: hashedPassword,
        role: Role.ADMIN,
      },
    });
  }

  console.log('Seeding Owner User...');
  const ownerEmail = 'owner@dride.com';
  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    const hashedPassword = await bcrypt.hash('owner123', 12);
    owner = await prisma.user.create({
      data: {
        name: 'D-Ride Owner',
        email: ownerEmail,
        phone: '+201111111111',
        password: hashedPassword,
        role: Role.OWNER,
      },
    });
  }

  console.log('Seeding Routes...');
  const cairoToAlex = await prisma.route.create({
    data: {
      name: 'Cairo to Alexandria',
      path: {
        type: 'LineString',
        coordinates: [
          [31.2357, 30.0444], // Cairo Start
          [31.1171, 30.0131], // Pyramids Toll entrance
          [30.985, 30.125], // Toll Station
          [30.65, 30.45], // Half-way Rest Point
          [30.49, 30.61], // Sadat City
          [30.29, 30.85], // Wadi El Natrun
          [29.98, 31.12], // Carrefour City Centre Alex
          [29.9187, 31.2001], // Alexandria Terminal
        ],
      } as any,
    },
  });

  const cairoToDahab = await prisma.route.create({
    data: {
      name: 'Cairo to Dahab',
      path: {
        type: 'LineString',
        coordinates: [
          [31.2357, 30.0444], // Cairo Start
          [31.75, 30.05], // Cairo-Suez Highway
          [32.3, 29.98], // Near Suez Canal
          [32.58, 29.99], // Ahmed Hamdi Tunnel
          [32.71, 29.58], // Ras Sudr (Sinai Coast)
          [33.1, 29.04], // Abu Zenima
          [33.18, 28.89], // Abu Rudeis
          [33.62, 28.24], // El Tor
          [34.33, 27.91], // Sharm El Sheikh
          [34.42, 28.2], // Sinai Mountain Pass
          [34.5152, 28.501], // Dahab Terminal
        ],
      } as any,
    },
  });

  console.log('Seeding Trips...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(10, 0, 0, 0);

  await prisma.trip.create({
    data: {
      routeId: cairoToAlex.id,
      departureTime: tomorrow,
      status: TripStatus.SCHEDULED,
      priceEGP: 250,
      availableSeats: 14,
      bookedSeats: 0,
      lockedSeats: [14],
    },
  });

  await prisma.trip.create({
    data: {
      routeId: cairoToDahab.id,
      departureTime: nextWeek,
      status: TripStatus.SCHEDULED,
      priceEGP: 600,
      availableSeats: 14,
      bookedSeats: 0,
      lockedSeats: [14],
    },
  });

  console.log('Seeding complete!');
  await app.close();
}

bootstrap();
