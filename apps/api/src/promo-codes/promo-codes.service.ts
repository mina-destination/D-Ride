import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';

@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromoCodeDto) {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.promoCode.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BadRequestException(`Promo code "${code}" already exists`);
    }

    return this.prisma.promoCode.create({
      data: {
        ...dto,
        code,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
    });
  }

  async findAll() {
    return this.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
    });
    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }
    return promo;
  }

  async update(id: string, dto: UpdatePromoCodeDto) {
    await this.findOne(id);

    const data: any = { ...dto };
    if (dto.code) {
      data.code = dto.code.trim().toUpperCase();
      const existing = await this.prisma.promoCode.findFirst({
        where: {
          code: data.code,
          id: { not: id },
        },
      });
      if (existing) {
        throw new BadRequestException(
          `Promo code "${data.code}" already exists`,
        );
      }
    }

    if (dto.expiryDate !== undefined) {
      data.expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;
    }

    return this.prisma.promoCode.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.promoCode.delete({
      where: { id },
    });
  }

  async validatePromoCode(
    codeStr: string,
    tripId: string,
    seatNumbers: number[],
    pickupStopId?: string,
    dropoffStopId?: string,
  ) {
    const code = codeStr.trim().toUpperCase();
    const promo = await this.prisma.promoCode.findUnique({
      where: { code },
    });

    if (!promo) {
      throw new BadRequestException('Invalid promo code');
    }

    if (!promo.isActive) {
      throw new BadRequestException('This promo code is inactive');
    }

    if (promo.expiryDate && new Date() > new Date(promo.expiryDate)) {
      throw new BadRequestException('This promo code has expired');
    }

    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
      throw new BadRequestException(
        'This promo code has reached its usage limit',
      );
    }

    // Retrieve Trip & Route to calculate segment price
    const currentTrip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { route: true },
    });
    if (!currentTrip) {
      throw new NotFoundException('Trip not found');
    }

    const routeCheckpoints = (currentTrip.route?.checkpoints as any[]) || [];
    const pickupCp = routeCheckpoints.find(
      (cp) => cp.id === pickupStopId || cp.name === pickupStopId,
    );
    const dropoffCp = routeCheckpoints.find(
      (cp) => cp.id === dropoffStopId || cp.name === dropoffStopId,
    );

    let segmentPrice = currentTrip.priceEGP || 0;
    if (pickupCp && dropoffCp) {
      if (pickupCp.prices && pickupCp.prices[dropoffCp.name] !== undefined) {
        segmentPrice = Number(pickupCp.prices[dropoffCp.name]);
      } else {
        const pickupPrice = Number(pickupCp.priceFromStartEGP || 0);
        const dropoffPrice = Number(
          dropoffCp.priceFromStartEGP || currentTrip.priceEGP || 0,
        );
        segmentPrice = dropoffPrice - pickupPrice;
      }
    }

    const baseFare = segmentPrice * seatNumbers.length;

    if (baseFare < promo.minBookingAmountEGP) {
      throw new BadRequestException(
        `Booking total (${baseFare} EGP) must be at least ${promo.minBookingAmountEGP} EGP to use this promo code`,
      );
    }

    let discount = 0;
    if (promo.discountType === 'FIXED') {
      discount = promo.discountValue;
    } else if (promo.discountType === 'PERCENTAGE') {
      discount = baseFare * (promo.discountValue / 100);
      if (promo.maxDiscountEGP !== null) {
        discount = Math.min(discount, promo.maxDiscountEGP);
      }
    }

    discount = Math.min(discount, baseFare); // Can't discount more than the fare
    const finalAmount = baseFare - discount;

    return {
      valid: true,
      discountEGP: discount,
      finalAmountEGP: finalAmount,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
    };
  }
}
