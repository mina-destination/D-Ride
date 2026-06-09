import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';

@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER')
  @Get()
  async findAll() {
    const promoCodes = await this.promoCodesService.findAll();
    return {
      success: true,
      data: promoCodes,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER')
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const promoCode = await this.promoCodesService.findOne(id);
    return {
      success: true,
      data: promoCode,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER')
  @Post()
  async create(@Body() createDto: CreatePromoCodeDto) {
    const promoCode = await this.promoCodesService.create(createDto);
    return {
      success: true,
      data: promoCode,
      message: 'Promo code created successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER')
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePromoCodeDto,
  ) {
    const promoCode = await this.promoCodesService.update(id, updateDto);
    return {
      success: true,
      data: promoCode,
      message: 'Promo code updated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER')
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.promoCodesService.remove(id);
    return {
      success: true,
      message: 'Promo code deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('validate')
  async validate(
    @Body('code') code: string,
    @Body('tripId') tripId: string,
    @Body('seatNumbers') seatNumbers: number[],
    @Body('pickupStopId') pickupStopId?: string,
    @Body('dropoffStopId') dropoffStopId?: string,
  ) {
    const result = await this.promoCodesService.validatePromoCode(
      code,
      tripId,
      seatNumbers,
      pickupStopId,
      dropoffStopId,
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
