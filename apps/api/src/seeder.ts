import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { UserEntity } from './schemas/user.schema';
import { Route } from './schemas/route.schema';
import { TripEntity } from './schemas/trip.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<UserEntity>>(getModelToken(UserEntity.name));
  const routeModel = app.get<Model<Route>>(getModelToken(Route.name));
  const tripModel = app.get<Model<TripEntity>>(getModelToken(TripEntity.name));

  console.log('Clearing existing data...');
  // Be careful: this deletes everything
  await routeModel.deleteMany({});
  await tripModel.deleteMany({});

  console.log('Seeding Admin User...');
  const adminEmail = 'admin@dride.com';
  let admin = await userModel.findOne({ email: adminEmail });
  if (!admin) {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    admin = await userModel.create({
      name: 'Super Admin',
      email: adminEmail,
      phone: '+201000000000',
      password: hashedPassword,
      role: 'ADMIN',
    });
  }

  console.log('Seeding Owner User...');
  const ownerEmail = 'owner@dride.com';
  let owner = await userModel.findOne({ email: ownerEmail });
  if (!owner) {
    const hashedPassword = await bcrypt.hash('owner123', 12);
    owner = await userModel.create({
      name: 'D-Ride Owner',
      email: ownerEmail,
      phone: '+201111111111',
      password: hashedPassword,
      role: 'OWNER',
    });
  }

  console.log('Seeding Routes...');
  const cairoToAlex = await routeModel.create({
    name: 'Cairo to Alexandria',
    path: {
      type: 'LineString',
      coordinates: [
        [31.2357, 30.0444],
        [29.9187, 31.2001],
      ],
    },
  });

  const cairoToDahab = await routeModel.create({
    name: 'Cairo to Dahab',
    path: {
      type: 'LineString',
      coordinates: [
        [31.2357, 30.0444],
        [34.5152, 28.501],
      ],
    },
  });

  console.log('Seeding Trips...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(10, 0, 0, 0);

  await tripModel.create({
    routeId: cairoToAlex._id,
    departureTime: tomorrow,
    status: 'SCHEDULED',
    priceEGP: 250,
    availableSeats: 14,
    bookedSeats: 0,
    lockedSeats: [14],
  });

  await tripModel.create({
    routeId: cairoToDahab._id,
    departureTime: nextWeek,
    status: 'SCHEDULED',
    priceEGP: 600,
    availableSeats: 14,
    bookedSeats: 0,
    lockedSeats: [14],
  });

  console.log('Seeding complete!');
  await app.close();
}

bootstrap();
