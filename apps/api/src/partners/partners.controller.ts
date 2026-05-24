import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PartnersService } from './partners.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  async findActive() {
    const partners = await this.partnersService.findActive();
    return {
      success: true,
      data: partners,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER')
  @Get('all')
  async findAll() {
    const partners = await this.partnersService.findAll();
    return {
      success: true,
      data: partners,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER')
  @Post()
  async create(@Body() data: CreatePartnerDto) {
    const partner = await this.partnersService.create(data);
    return {
      success: true,
      data: partner,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER')
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: UpdatePartnerDto) {
    const partner = await this.partnersService.update(id, data);
    return {
      success: true,
      data: partner,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'OWNER')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.partnersService.delete(id);
    return {
      success: true,
      message: 'Partner deleted successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
