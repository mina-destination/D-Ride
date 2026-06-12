import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { QueryTransactionsDto } from './dto/query-transactions.dto';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION')
  @Get()
  async findAll(@Query() query: QueryTransactionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
    if (query.userId) where.userId = query.userId;
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          booking: {
            select: { id: true, status: true, amountEGP: true, tripId: true },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION')
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        booking: {
          select: { id: true, status: true, amountEGP: true, tripId: true },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return {
      success: true,
      data: transaction,
      timestamp: new Date().toISOString(),
    };
  }
}
