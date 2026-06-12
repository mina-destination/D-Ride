import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createReview(@Req() req: any, @Body() data: CreateReviewDto) {
    const userId = req.user.sub || req.user.userId || req.user.id;
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION')
  @Get()
  async findAllAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('rating') rating?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit
      ? Math.min(100, Math.max(1, parseInt(limit, 10)))
      : 20;
    const ratingNum = rating ? parseInt(rating, 10) : undefined;

    return this.reviewsService.findAllAdmin(
      pageNum,
      limitNum,
      ratingNum,
      startDate,
      endDate,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const review = await this.reviewsService.remove(id);
    return {
      success: true,
      message: 'Review deleted successfully',
      data: review,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION')
  @Get('stats')
  async getStats() {
    return this.reviewsService.getStats();
  }
}
