import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(
    userId: string,
    data: { bookingId: string; rating: number; comment?: string },
  ) {
    // 1. Verify booking exists, is owned by user, and status is boarded/completed
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { review: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new BadRequestException('You do not own this booking');
    }

    if (
      booking.status !== BookingStatus.BOARDED &&
      booking.status !== BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'You can only review boarded or completed trips',
      );
    }

    // 2. Verify no double reviewing
    if (booking.review) {
      throw new BadRequestException(
        'You have already submitted a review for this booking',
      );
    }

    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // 3. Create review
    const review = await this.prisma.review.create({
      data: {
        bookingId: data.bookingId,
        userId: userId,
        tripId: booking.tripId,
        rating: data.rating,
        comment: data.comment || null,
      },
    });

    return { ...review, _id: review.id };
  }

  async getDriverAverageRating(driverId: string) {
    // Aggregates reviews for trips driven by driverId
    const result = await this.prisma.review.aggregate({
      where: {
        trip: {
          driverId: driverId,
        },
      },
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
    });

    const averageRating = result._avg.rating
      ? parseFloat(result._avg.rating.toFixed(1))
      : 0;
    const totalReviews = result._count.id || 0;

    return {
      driverId,
      averageRating,
      totalReviews,
    };
  }

  async getTripReviews(tripId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { tripId },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => ({
      ...r,
      _id: r.id,
      userName: r.user?.name || 'Passenger',
      userAvatar: r.user?.avatarUrl || null,
    }));
  }

  async getDriverReviews(driverId: string) {
    const reviews = await this.prisma.review.findMany({
      where: {
        trip: {
          driverId: driverId,
        },
      },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => ({
      ...r,
      _id: r.id,
      userName: r.user?.name || 'Passenger',
      userAvatar: r.user?.avatarUrl || null,
    }));
  }
}
