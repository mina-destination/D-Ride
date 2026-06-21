import { describe, it, expect } from 'vitest';
import type { Trip, Checkpoint } from '../pricing';
import {
  calculateLegPrice,
  calculatePremiumSurcharge,
  calculateSubTotalFare,
} from '../pricing';

describe('Pricing Calculations', () => {
  const mockTrip: Trip = {
    priceEGP: 100,
    premiumSeatSurcharge: 25,
  };

  const mockPickup: Checkpoint = {
    name: 'Pickup Point',
    priceFromStartEGP: 10,
    prices: {
      'Dropoff Point': 85,
    },
    premiumSurcharges: {
      'Dropoff Point': 30,
    },
  };

  const mockDropoff: Checkpoint = {
    name: 'Dropoff Point',
    priceFromStartEGP: 90,
  };

  describe('calculateLegPrice', () => {
    it('returns 0 if trip is null', () => {
      expect(calculateLegPrice(null, null, null)).toBe(0);
    });

    it('returns direct mapped price if defined on pickup checkpoint for dropoff name', () => {
      const price = calculateLegPrice(mockTrip, mockPickup, mockDropoff);
      expect(price).toBe(85);
    });

    it('calculates checkpoint distance cost difference when mapping is not defined', () => {
      const pickupWithoutDirectPrice: Checkpoint = {
        name: 'Another Pickup',
        priceFromStartEGP: 15,
      };
      const price = calculateLegPrice(mockTrip, pickupWithoutDirectPrice, mockDropoff);
      // dropoff (90) - pickup (15) = 75
      expect(price).toBe(75);
    });

    it('falls back to trip default price if checkpoints calculate negative or zero values', () => {
      const pickupHigher: Checkpoint = {
        name: 'High Pickup',
        priceFromStartEGP: 120,
      };
      const price = calculateLegPrice(mockTrip, pickupHigher, mockDropoff);
      expect(price).toBe(100);
    });

    it('falls back to trip default price if checkpoints are not provided', () => {
      const price = calculateLegPrice(mockTrip, null, null);
      expect(price).toBe(100);
    });
  });

  describe('calculatePremiumSurcharge', () => {
    it('returns 0 if trip is null', () => {
      expect(calculatePremiumSurcharge(null, null, null)).toBe(0);
    });

    it('returns direct premium surcharge if defined for dropoff checkpoint name', () => {
      const surcharge = calculatePremiumSurcharge(mockTrip, mockPickup, mockDropoff);
      expect(surcharge).toBe(30);
    });

    it('falls back to trip default premium seat surcharge if mapping does not exist', () => {
      const pickupWithoutSurcharge: Checkpoint = {
        name: 'Another Pickup',
        priceFromStartEGP: 15,
      };
      const surcharge = calculatePremiumSurcharge(mockTrip, pickupWithoutSurcharge, mockDropoff);
      expect(surcharge).toBe(25);
    });

    it('falls back to trip default surcharge if checkpoints are not provided', () => {
      const surcharge = calculatePremiumSurcharge(mockTrip, null, null);
      expect(surcharge).toBe(25);
    });
  });

  describe('calculateSubTotalFare', () => {
    it('calculates regular subtotal fare when seat 1 is not selected', () => {
      const subtotal = calculateSubTotalFare({
        legPrice: 80,
        selectedSeats: [2, 3],
        premiumSurcharge: 20,
      });
      // 80 * 2 = 160
      expect(subtotal).toBe(160);
    });

    it('adds premium surcharge to subtotal fare when seat 1 is selected', () => {
      const subtotal = calculateSubTotalFare({
        legPrice: 80,
        selectedSeats: [1, 2, 3],
        premiumSurcharge: 20,
      });
      // 80 * 3 + 20 = 260
      expect(subtotal).toBe(260);
    });

    it('returns 0 when no seats are selected', () => {
      const subtotal = calculateSubTotalFare({
        legPrice: 80,
        selectedSeats: [],
        premiumSurcharge: 20,
      });
      expect(subtotal).toBe(0);
    });
  });
});
