export interface Trip {
  priceEGP?: number;
  premiumSeatSurcharge?: number;
  [key: string]: any;
}

export interface Checkpoint {
  name: string;
  prices?: Record<string, number>;
  premiumSurcharges?: Record<string, number>;
  priceFromStartEGP?: number;
  [key: string]: any;
}

export function calculateLegPrice(
  trip: Trip | null,
  pickup: Checkpoint | null,
  dropoff: Checkpoint | null
): number {
  if (!trip) return 0;
  if (pickup && dropoff) {
    if (pickup.prices && pickup.prices[dropoff.name] !== undefined) {
      return Number(pickup.prices[dropoff.name]);
    }
    const pickupPrice = Number(pickup.priceFromStartEGP || 0);
    const dropoffPrice = Number(dropoff.priceFromStartEGP || trip.priceEGP || 0);
    const legPrice = dropoffPrice - pickupPrice;
    if (legPrice > 0) return legPrice;
  }
  return Number(trip.priceEGP || 0);
}

export function calculatePremiumSurcharge(
  trip: Trip | null,
  pickup: Checkpoint | null,
  dropoff: Checkpoint | null
): number {
  if (!trip) return 0;
  if (pickup && dropoff) {
    if (pickup.premiumSurcharges && pickup.premiumSurcharges[dropoff.name] !== undefined) {
      return Number(pickup.premiumSurcharges[dropoff.name]);
    }
  }
  return Number(trip.premiumSeatSurcharge || 0);
}

export function calculateSubTotalFare({
  legPrice,
  selectedSeats,
  premiumSurcharge,
}: {
  legPrice: number;
  selectedSeats: number[];
  premiumSurcharge: number;
}): number {
  const hasSeat1 = selectedSeats.some(s => Number(s) === 1);
  return legPrice * selectedSeats.length + (hasSeat1 ? premiumSurcharge : 0);
}
