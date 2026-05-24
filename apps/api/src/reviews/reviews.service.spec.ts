import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      booking: {
        findUnique: jest.fn(),
      },
      review: {
        create: jest.fn(),
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReview', () => {
    const userId = 'user-123';
    const data = {
      bookingId: 'booking-123',
      rating: 5,
      comment: 'Great ride!',
    };

    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);

      await expect(service.createReview(userId, data)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if booking belongs to someone else', async () => {
      const mockBooking = {
        id: 'booking-123',
        userId: 'other-user',
        status: BookingStatus.COMPLETED,
        review: null,
      };
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(service.createReview(userId, data)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if booking status is not boarded or completed', async () => {
      const mockBooking = {
        id: 'booking-123',
        userId: userId,
        status: BookingStatus.CONFIRMED,
        review: null,
      };
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(service.createReview(userId, data)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if review is already submitted', async () => {
      const mockBooking = {
        id: 'booking-123',
        userId: userId,
        status: BookingStatus.COMPLETED,
        review: { id: 'review-123' },
      };
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(service.createReview(userId, data)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if rating is out of bounds', async () => {
      const mockBooking = {
        id: 'booking-123',
        userId: userId,
        status: BookingStatus.COMPLETED,
        review: null,
      };
      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);

      await expect(
        service.createReview(userId, { ...data, rating: 6 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create and return the review if all validations pass', async () => {
      const mockBooking = {
        id: 'booking-123',
        userId: userId,
        tripId: 'trip-123',
        status: BookingStatus.COMPLETED,
        review: null,
      };
      const createdReview = {
        id: 'review-123',
        bookingId: 'booking-123',
        userId: userId,
        tripId: 'trip-123',
        rating: 5,
        comment: 'Great ride!',
        createdAt: new Date(),
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrismaService.review.create.mockResolvedValue(createdReview);

      const result = await service.createReview(userId, data);

      expect(result).toBeDefined();
      expect(result._id).toBe('review-123');
      expect(result.rating).toBe(5);
      expect(mockPrismaService.review.create).toHaveBeenCalledWith({
        data: {
          bookingId: 'booking-123',
          userId: userId,
          tripId: 'trip-123',
          rating: 5,
          comment: 'Great ride!',
        },
      });
    });
  });

  describe('getDriverAverageRating', () => {
    it('should return aggregated rating values', async () => {
      const driverId = 'driver-123';
      const mockAggregateResult = {
        _avg: {
          rating: 4.6666,
        },
        _count: {
          id: 3,
        },
      };

      mockPrismaService.review.aggregate.mockResolvedValue(mockAggregateResult);

      const result = await service.getDriverAverageRating(driverId);

      expect(result).toBeDefined();
      expect(result.driverId).toBe(driverId);
      expect(result.averageRating).toBe(4.7);
      expect(result.totalReviews).toBe(3);
    });

    it('should return 0 rating and reviews if no aggregate is found', async () => {
      const driverId = 'driver-123';
      const mockAggregateResult = {
        _avg: {
          rating: null,
        },
        _count: {
          id: 0,
        },
      };

      mockPrismaService.review.aggregate.mockResolvedValue(mockAggregateResult);

      const result = await service.getDriverAverageRating(driverId);

      expect(result.averageRating).toBe(0);
      expect(result.totalReviews).toBe(0);
    });
  });
});
