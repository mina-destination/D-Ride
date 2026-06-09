import { PrismaClient, Role, TripStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Running Safe Production Bootstrap Seeder...');

  const defaultPassword = await bcrypt.hash('dride123', 12);
  const adminPassword = await bcrypt.hash('admin123', 12);
  const ownerPassword = await bcrypt.hash('owner123', 12);

  // 1. Bootstrap Admin
  const adminEmail = 'admin@dride.com';
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: adminEmail,
        phone: '+201000000000',
        password: adminPassword,
        role: Role.ADMIN,
      },
    });
    console.log('✅ Created Admin user');
  } else {
    console.log('ℹ️ Admin user already exists');
  }

  // 2. Bootstrap Owner
  const ownerEmail = 'owner@dride.com';
  let owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        name: 'D-Ride Owner',
        email: ownerEmail,
        phone: '+201111111111',
        password: ownerPassword,
        role: Role.OWNER,
      },
    });
    console.log('✅ Created Owner user');
  } else {
    console.log('ℹ️ Owner user already exists');
  }

  // 3. Bootstrap Drivers
  const driver1Email = 'ahmed@dride.com';
  let driver1 = await prisma.user.findUnique({ where: { email: driver1Email } });
  if (!driver1) {
    driver1 = await prisma.user.create({
      data: {
        name: 'Ahmed Mansour',
        email: driver1Email,
        phone: '+201201234567',
        password: defaultPassword,
        role: Role.DRIVER,
      },
    });
    console.log('✅ Created Driver 1 (ahmed@dride.com)');
  } else {
    console.log('ℹ️ Driver 1 already exists');
  }

  const driver2Email = 'youssef@dride.com';
  let driver2 = await prisma.user.findUnique({ where: { email: driver2Email } });
  if (!driver2) {
    driver2 = await prisma.user.create({
      data: {
        name: 'Youssef Ibrahim',
        email: driver2Email,
        phone: '+201207654321',
        password: defaultPassword,
        role: Role.DRIVER,
      },
    });
    console.log('✅ Created Driver 2 (youssef@dride.com)');
  } else {
    console.log('ℹ️ Driver 2 already exists');
  }

  // 4. Bootstrap Vehicles
  let vehicle1 = await prisma.vehicle.findFirst({ where: { driverId: driver1.id } });
  if (!vehicle1) {
    vehicle1 = await prisma.vehicle.create({
      data: {
        model: 'Toyota::HiAce',
        plateNumber: 'ط ر ق ٥٤٣٢',
        capacity: 14,
        driverId: driver1.id,
        isActive: true,
      },
    });
    console.log('✅ Created Vehicle 1');
  } else {
    console.log('ℹ️ Vehicle 1 already exists');
  }

  let vehicle2 = await prisma.vehicle.findFirst({ where: { driverId: driver2.id } });
  if (!vehicle2) {
    vehicle2 = await prisma.vehicle.create({
      data: {
        model: 'Chevrolet::Movano',
        plateNumber: 'ع ص م ٩٨٧٦',
        capacity: 14,
        driverId: driver2.id,
        isActive: true,
      },
    });
    console.log('✅ Created Vehicle 2');
  } else {
    console.log('ℹ️ Vehicle 2 already exists');
  }

  // 5. Bootstrap Routes
  let routeCount = await prisma.route.count();
  let route1Id = '';
  if (routeCount === 0) {
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
            [30.29, 30.85],
            [29.9187, 31.2001],
          ],
        },
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
    route1Id = cairoToAlex.id;
    console.log('✅ Created Cairo to Alex Route');
  } else {
    const route = await prisma.route.findFirst();
    route1Id = route ? route.id : '';
    console.log('ℹ️ Routes already exist');
  }

  // 6. Bootstrap Upcoming Trip (so driver portal has a shift to test immediately)
  let tripCount = await prisma.trip.count();
  if (tripCount === 0 && route1Id) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    await prisma.trip.create({
      data: {
        routeId: route1Id,
        departureTime: tomorrow,
        status: TripStatus.SCHEDULED,
        priceEGP: 250,
        availableSeats: 14,
        bookedSeats: 0,
        driverId: driver1.id,
        vehicleId: vehicle1.id,
      },
    });
    console.log('✅ Created Tomorrow Shift Trip for Ahmed Mansour');
  } else {
    console.log('ℹ️ Trips already exist');
  }

  console.log('🎉 Safe Production Bootstrap Seeder complete!');
}

main()
  .catch((e) => {
    console.error('❌ Bootstrap Seeder failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
