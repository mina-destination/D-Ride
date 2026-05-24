import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma/prisma.service';
import { Role, TripStatus, BookingStatus, PaymentStatus } from '@prisma/client';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  console.log('Clearing existing data (in dependency order)...');
  await prisma.review.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.liveVehicleLocation.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.route.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.user.deleteMany();

  const defaultPassword = await bcrypt.hash('dride123', 12);

  console.log('Seeding Admin & Owner Users...');
  const admin = await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: 'admin@dride.com',
      phone: '+201000000000',
      password: await bcrypt.hash('admin123', 12),
      role: Role.ADMIN,
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: 'D-Ride Owner',
      email: 'owner@dride.com',
      phone: '+201111111111',
      password: await bcrypt.hash('owner123', 12),
      role: Role.OWNER,
    },
  });

  console.log('Seeding Drivers...');
  const driver1 = await prisma.user.create({
    data: {
      name: 'Ahmed Mansour',
      email: 'ahmed@dride.com',
      phone: '+201201234567',
      password: defaultPassword,
      role: Role.DRIVER,
    },
  });

  const driver2 = await prisma.user.create({
    data: {
      name: 'Youssef Ibrahim',
      email: 'youssef@dride.com',
      phone: '+201207654321',
      password: defaultPassword,
      role: Role.DRIVER,
    },
  });

  console.log('Seeding Vehicles...');
  const vehicle1 = await prisma.vehicle.create({
    data: {
      model: 'Toyota::HiAce',
      plateNumber: 'ط ر ق ٥٤٣٢',
      capacity: 14,
      driverId: driver1.id,
      isActive: true,
    },
  });

  const vehicle2 = await prisma.vehicle.create({
    data: {
      model: 'Chevrolet::Movano',
      plateNumber: 'ع ص م ٩٨٧٦',
      capacity: 14,
      driverId: driver2.id,
      isActive: true,
    },
  });

  console.log('Seeding Passenger Users...');
  const passenger1 = await prisma.user.create({
    data: {
      name: 'Hassan Ali',
      email: 'hassan@dride.com',
      phone: '+201002223334',
      password: defaultPassword,
      role: Role.PASSENGER,
      walletBalance: 1000,
    },
  });

  const passenger2 = await prisma.user.create({
    data: {
      name: 'Mona Kamel',
      email: 'mona@dride.com',
      phone: '+201004445556',
      password: defaultPassword,
      role: Role.PASSENGER,
      walletBalance: 500,
    },
  });

  console.log('Seeding Routes with Checkpoints...');
  const cairoToAlex = await prisma.route.create({
    data: {
      name: 'Cairo to Alexandria',
      distanceKm: 220,
      estimatedDurationMinutes: 180,
      path: {
        type: 'LineString',
        coordinates: [
          [31.2357, 30.0444],
          [31.1171, 30.0131],
          [30.985, 30.125],
          [30.65, 30.45],
          [30.49, 30.61],
          [30.29, 30.85],
          [29.98, 31.12],
          [29.9187, 31.2001],
        ],
      } as any,
      checkpoints: [
        {
          name: 'Ramses Square Start',
          nameAr: 'ميدان رمسيس البداية',
          type: 'START',
          location: { type: 'Point', coordinates: [31.2357, 30.0444] },
          order: 1,
        },
        {
          name: 'Pyramids Toll Station',
          nameAr: 'بوابة رسوم الأهرامات',
          type: 'CHECKPOINT',
          location: { type: 'Point', coordinates: [31.1171, 30.0131] },
          order: 2,
        },
        {
          name: 'Wadi El Natrun Rest Area',
          nameAr: 'استراحة وادي النطرون',
          type: 'CHECKPOINT',
          location: { type: 'Point', coordinates: [30.29, 30.85] },
          order: 3,
        },
        {
          name: 'Alexandria Terminal',
          nameAr: 'محطة الإسكندرية النهائية',
          type: 'END',
          location: { type: 'Point', coordinates: [29.9187, 31.2001] },
          order: 4,
        },
      ] as any,
    },
  });

  const cairoToDahab = await prisma.route.create({
    data: {
      name: 'Cairo to Dahab',
      distanceKm: 550,
      estimatedDurationMinutes: 420,
      path: {
        type: 'LineString',
        coordinates: [
          [31.2357, 30.0444],
          [31.75, 30.05],
          [32.3, 29.98],
          [32.58, 29.99],
          [32.71, 29.58],
          [33.1, 29.04],
          [33.18, 28.89],
          [33.62, 28.24],
          [34.33, 27.91],
          [34.42, 28.2],
          [34.5152, 28.501],
        ],
      } as any,
      checkpoints: [
        {
          name: 'Abbassia Terminal Start',
          nameAr: 'محطة العباسية البداية',
          type: 'START',
          location: { type: 'Point', coordinates: [31.2825, 30.0635] },
          order: 1,
        },
        {
          name: 'Suez Toll gate',
          nameAr: 'بوابة السويس',
          type: 'CHECKPOINT',
          location: { type: 'Point', coordinates: [32.3, 29.98] },
          order: 2,
        },
        {
          name: 'Sharm El Sheikh Terminal',
          nameAr: 'موقف شرم الشيخ',
          type: 'CHECKPOINT',
          location: { type: 'Point', coordinates: [34.33, 27.91] },
          order: 3,
        },
        {
          name: 'Dahab Terminal End',
          nameAr: 'محطة دهب النهائية',
          type: 'END',
          location: { type: 'Point', coordinates: [34.5152, 28.501] },
          order: 4,
        },
      ] as any,
    },
  });

  console.log('Seeding Completed Trips & Bookings (for rating aggregation)...');
  const pastTrip = await prisma.trip.create({
    data: {
      routeId: cairoToAlex.id,
      departureTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      arrivalTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      status: TripStatus.COMPLETED,
      priceEGP: 250,
      availableSeats: 14,
      bookedSeats: 2,
      driverId: driver1.id,
      vehicleId: vehicle1.id,
    },
  });

  const booking1 = await prisma.booking.create({
    data: {
      userId: passenger1.id,
      tripId: pastTrip.id,
      seatNumbers: [3],
      status: BookingStatus.COMPLETED,
      paymentStatus: PaymentStatus.SUCCESS,
      amountEGP: 250,
      pickupCheckpoint: { name: 'Ramses Square Start' },
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      userId: passenger2.id,
      tripId: pastTrip.id,
      seatNumbers: [4],
      status: BookingStatus.COMPLETED,
      paymentStatus: PaymentStatus.SUCCESS,
      amountEGP: 250,
      pickupCheckpoint: { name: 'Ramses Square Start' },
    },
  });

  console.log('Seeding Reviews...');
  await prisma.review.create({
    data: {
      bookingId: booking1.id,
      userId: passenger1.id,
      tripId: pastTrip.id,
      rating: 5,
      comment: 'Excellent trip! The captain was incredibly professional, vehicle was sparkling clean, and we arrived exactly on time.',
    },
  });

  await prisma.review.create({
    data: {
      bookingId: booking2.id,
      userId: passenger2.id,
      tripId: pastTrip.id,
      rating: 4,
      comment: 'A very comfortable journey. Minor delay at the toll gates, but overall driver handled the route exceptionally well.',
    },
  });

  console.log('Seeding Upcoming Trips...');
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
      driverId: driver1.id,
      vehicleId: vehicle1.id,
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
      driverId: driver2.id,
      vehicleId: vehicle2.id,
    },
  });

  console.log('Seeding Brand Partners...');
  await prisma.partner.createMany({
    data: [
      {
        name: 'Paymob Egypt',
        logoUrl: 'https://cdn.brandfetch.net/idS-N-v48N/w/400/h/400/theme/dark/icon.png?bf=true&id=collection-eRNgT9P_H0',
        websiteUrl: 'https://paymob.com',
        isActive: true,
      },
      {
        name: 'Orange Egypt',
        logoUrl: 'https://cdn.brandfetch.net/idB24t81j1/w/400/h/400/theme/dark/icon.png?bf=true&id=collection-qG3H_m6754',
        websiteUrl: 'https://orange.eg',
        isActive: true,
      },
      {
        name: 'Vodafone Cash',
        logoUrl: 'https://cdn.brandfetch.net/idJ05z95O2/w/400/h/400/theme/dark/icon.png?bf=true&id=collection-yRzZ748u3o',
        websiteUrl: 'https://vodafone.com.eg',
        isActive: true,
      },
      {
        name: 'Alexandria University',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Alexandria_University_logo.svg/400px-Alexandria_University_logo.svg.png',
        websiteUrl: 'https://alexu.edu.eg',
        isActive: true,
      },
      {
        name: 'Cairo University',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Cairo_university_seal.svg/400px-Cairo_university_seal.svg.png',
        websiteUrl: 'https://cu.edu.eg',
        isActive: true,
      },
    ],
  });

  console.log('Seeding complete!');
  await app.close();
}

bootstrap();
