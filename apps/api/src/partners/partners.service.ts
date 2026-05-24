import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@Injectable()
export class PartnersService {
  constructor(private prisma: PrismaService) {}

  async findActive() {
    return this.prisma.partner.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.partner.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async create(data: CreatePartnerDto) {
    return this.prisma.partner.create({
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        websiteUrl: data.websiteUrl,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(id: string, data: UpdatePartnerDto) {
    try {
      return await this.prisma.partner.update({
        where: { id },
        data,
      });
    } catch (err) {
      throw new NotFoundException('Partner not found');
    }
  }

  async delete(id: string) {
    try {
      await this.prisma.partner.delete({
        where: { id },
      });
      return { success: true };
    } catch (err) {
      throw new NotFoundException('Partner not found');
    }
  }
}
