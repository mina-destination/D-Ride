-- AlterTable: Add missing priceEGP and premiumSeatSurcharge columns to routes
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "priceEGP" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "premiumSeatSurcharge" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: Add missing actualPath column to trips
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "actualPath" JSONB;
