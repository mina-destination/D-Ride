-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PASSENGER', 'DRIVER', 'OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('SCHEDULED', 'BOARDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'BOARDED', 'CANCELLED', 'COMPLETED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "StopType" AS ENUM ('START', 'CHECKPOINT', 'END');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PASSENGER',
    "avatarUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "crmNotes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 14,
    "driverId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SHUTTLE_BUS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" JSONB NOT NULL,
    "coverImage" TEXT,
    "checkpoints" JSONB NOT NULL DEFAULT '[]',
    "distanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedDurationMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "arrivalTime" TIMESTAMP(3),
    "status" "TripStatus" NOT NULL DEFAULT 'SCHEDULED',
    "priceEGP" DOUBLE PRECISION NOT NULL,
    "availableSeats" INTEGER NOT NULL,
    "bookedSeats" INTEGER NOT NULL DEFAULT 0,
    "lockedSeats" JSONB NOT NULL DEFAULT '[14]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "seatNumbers" JSONB NOT NULL,
    "pickupStopId" TEXT,
    "dropoffStopId" TEXT,
    "pickupCheckpoint" JSONB,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymobOrderId" INTEGER,
    "amountEGP" DOUBLE PRECISION NOT NULL,
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qrVerificationToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_vehicle_locations" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "location" JSONB NOT NULL,
    "speedKmh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "headingDegrees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "batteryPercentage" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_vehicle_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "replies" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "userId" TEXT NOT NULL,
    "paymobOrderId" INTEGER,
    "amountEGP" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL,
    "paymobPaymentId" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_key" ON "role_permissions"("role");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plateNumber_key" ON "vehicles"("plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_paymobOrderId_key" ON "bookings"("paymobOrderId");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_vehicle_locations" ADD CONSTRAINT "live_vehicle_locations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
