import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createReview(
    @Req() req: any,
    @Body() data: { bookingId: string; rating: number; comment?: string },
  ) {
    const userId = req.user.userId || req.user.id;
    const review = await this.reviewsService.createReview(userId, data);
    return {
      success: true,
      data: review,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('driver/:driverId')
  async getDriverAverageRating(@Param('driverId') driverId: string) {
    const stats = await this.reviewsService.getDriverAverageRating(driverId);
    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('trip/:tripId')
  async getTripReviews(@Param('tripId') tripId: string) {
    const reviews = await this.reviewsService.getTripReviews(tripId);
    return {
      success: true,
      data: reviews,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('driver/:driverId/list')
  async getDriverReviews(@Param('driverId') driverId: string) {
    const reviews = await this.reviewsService.getDriverReviews(driverId);
    return {
      success: true,
      data: reviews,
      timestamp: new Date().toISOString(),
    };
  }
}
