import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { MailService } from './mail.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
  ) {}

  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION')
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit
      ? Math.min(100, Math.max(1, parseInt(limit, 10)))
      : 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION')
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return {
      success: true,
      data: notification,
      timestamp: new Date().toISOString(),
    };
  }

  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION')
  @Post('send')
  async send(
    @Body()
    body: {
      userId: string;
      title: string;
      message: string;
      channel: 'SMS' | 'EMAIL' | 'WHATSAPP' | 'IN_APP';
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: body.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: user.id,
        type: 'BOOKING_CONFIRMATION',
        channel: body.channel,
        title: body.title,
        message: body.message,
        status: 'SENT',
      },
    });

    let sent = true;
    switch (body.channel) {
      case 'SMS':
        sent = await this.notificationsService.sendSMS(
          user.phone,
          body.message,
        );
        break;
      case 'WHATSAPP':
        sent = await this.notificationsService.sendWhatsApp(
          user.phone,
          body.message,
        );
        break;
      case 'EMAIL':
        sent = await this.mailService.sendMail(
          user.email,
          body.title,
          body.message,
        );
        break;
      case 'IN_APP':
        break;
    }

    if (!sent) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED' },
      });
    }

    const updated = await this.prisma.notification.findUnique({
      where: { id: notification.id },
    });

    return {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };
  }

  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN', 'OPERATION')
  @Post('broadcast')
  async broadcast(
    @Body()
    body: {
      title: string;
      message: string;
      channel: 'SMS' | 'EMAIL' | 'WHATSAPP' | 'IN_APP';
      userRole?: string;
    },
  ) {
    const role = (body.userRole || 'PASSENGER').toUpperCase();
    const users = await this.prisma.user.findMany({
      where: { role: role as any, isActive: true },
    });

    let createdCount = 0;
    for (const user of users) {
      await this.prisma.notification.create({
        data: {
          userId: user.id,
          type: 'BROADCAST',
          channel: body.channel,
          title: body.title,
          message: body.message,
          status: 'SENT',
        },
      });
      createdCount++;

      switch (body.channel) {
        case 'SMS':
          await this.notificationsService.sendSMS(user.phone, body.message);
          break;
        case 'WHATSAPP':
          await this.notificationsService.sendWhatsApp(
            user.phone,
            body.message,
          );
          break;
        case 'EMAIL':
          await this.mailService.sendMail(user.email, body.title, body.message);
          break;
        case 'IN_APP':
          break;
      }
    }

    return {
      success: true,
      data: { count: createdCount, totalUsers: users.length },
      timestamp: new Date().toISOString(),
    };
  }
}
