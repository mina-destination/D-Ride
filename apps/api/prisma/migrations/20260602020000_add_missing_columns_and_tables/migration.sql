-- AlterTable: Add missing columns to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordOtp" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resetPasswordOtpExpires" TIMESTAMP(3);

-- AlterTable: Add missing columns to routes
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add missing columns to bookings
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "dropoffCheckpoint" JSONB;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "boardingNumber" INTEGER;

-- AlterTable: Make vehicleId unique on live_vehicle_locations (skip if already unique)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'live_vehicle_locations_vehicleId_key'
  ) THEN
    CREATE UNIQUE INDEX "live_vehicle_locations_vehicleId_key" ON "live_vehicle_locations"("vehicleId");
  END IF;
END $$;

-- CreateTable: chat_messages
CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: reviews
CREATE TABLE IF NOT EXISTS "reviews" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable: partners
CREATE TABLE IF NOT EXISTS "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'trips_routeId_status_departureTime_idx') THEN
    CREATE INDEX "trips_routeId_status_departureTime_idx" ON "trips"("routeId", "status", "departureTime");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'bookings_tripId_status_idx') THEN
    CREATE INDEX "bookings_tripId_status_idx" ON "bookings"("tripId", "status");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'bookings_userId_idx') THEN
    CREATE INDEX "bookings_userId_idx" ON "bookings"("userId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'transactions_userId_status_idx') THEN
    CREATE INDEX "transactions_userId_status_idx" ON "transactions"("userId", "status");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'transactions_bookingId_idx') THEN
    CREATE INDEX "transactions_bookingId_idx" ON "transactions"("bookingId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'chat_messages_ticketId_idx') THEN
    CREATE INDEX "chat_messages_ticketId_idx" ON "chat_messages"("ticketId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'reviews_bookingId_key') THEN
    CREATE UNIQUE INDEX "reviews_bookingId_key" ON "reviews"("bookingId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'reviews_tripId_idx') THEN
    CREATE INDEX "reviews_tripId_idx" ON "reviews"("tripId");
  END IF;
END $$;

-- AddForeignKeys for chat_messages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chat_messages_senderId_fkey'
  ) THEN
    ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chat_messages_ticketId_fkey'
  ) THEN
    ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKeys for reviews
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_bookingId_fkey'
  ) THEN
    ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_tripId_fkey'
  ) THEN
    ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_userId_fkey'
  ) THEN
    ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
