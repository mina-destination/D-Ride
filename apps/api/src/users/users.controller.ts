import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { AddCrmNoteDto } from './dto/add-crm-note.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('ADMIN')
  @Get()
  async getUsersByRole(@Query('role') role?: string) {
    if (!role) {
      return this.usersService.findAll();
    }
    return this.usersService.findAllByRole(role.toUpperCase());
  }

  @Roles('OWNER', 'SUPER_ADMIN', 'ADMIN')
  @Get('role-permissions')
  async getRolePermissions() {
    return this.usersService.getRolePermissions();
  }

  @Roles('OWNER')
  @Put('role-permissions')
  async updateRolePermissions(@Body() body: UpdateRolePermissionsDto) {
    return this.usersService.updateRolePermissions(body.role, body.permissions);
  }

  @Roles('ADMIN')
  @Post(':id/notes')
  async addCrmNote(@Param('id') id: string, @Body() data: AddCrmNoteDto) {
    return this.usersService.addCrmNote(id, data.text, data.adminName);
  }

  @Roles('ADMIN')
  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Roles('ADMIN')
  @Post()
  async createUser(@Body() data: CreateUserDto) {
    return this.usersService.createUser(data);
  }

  @Roles('ADMIN')
  @Put(':id')
  async updateUser(@Param('id') id: string, @Body() data: UpdateUserDto) {
    return this.usersService.updateUser(id, data);
  }

  @Roles('ADMIN')
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
