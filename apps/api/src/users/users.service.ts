import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  private mapUser(user: any) {
    if (!user) return null;
    const u = { ...user };
    delete u.password;
    u.status = user.isActive ? 'ACTIVE' : 'INACTIVE';
    return u;
  }

  async onModuleInit() {
    await this.seedDefaultPermissions();
  }

  private async seedDefaultPermissions() {
    const count = await this.prisma.rolePermission.count();
    if (count === 0) {
      await this.prisma.rolePermission.createMany({
        data: [
          {
            role: Role.SUPER_ADMIN,
            permissions: [
              'dashboard',
              'routes',
              'trips',
              'vehicles',
              'drivers',
              'bookings',
              'payments',
              'passengers',
              'crm',
              'settings',
            ],
          },
          {
            role: Role.ADMIN,
            permissions: [
              'dashboard',
              'routes',
              'trips',
              'vehicles',
              'drivers',
              'bookings',
              'payments',
              'passengers',
              'crm',
            ],
          },
          {
            role: Role.OPERATION,
            permissions: [
              'dashboard',
              'routes',
              'trips',
              'vehicles',
              'drivers',
              'bookings',
            ],
          },
        ],
      });
      console.log('Seeded default role permissions successfully');
    }
  }

  async getRolePermissions(): Promise<any[]> {
    return this.prisma.rolePermission.findMany();
  }

  async updateRolePermissions(
    role: string,
    permissions: string[],
  ): Promise<any> {
    const roleEnum = role.toUpperCase() as Role;
    const updated = await this.prisma.rolePermission.upsert({
      where: { role: roleEnum },
      update: { permissions },
      create: { role: roleEnum, permissions },
    });
    return updated;
  }

  async findAllByRole(role: string): Promise<any[]> {
    const users = await this.prisma.user.findMany({
      where: { role: role.toUpperCase() as Role },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => this.mapUser(user));
  }

  async findAll(): Promise<any[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map((user) => this.mapUser(user));
  }

  async addCrmNote(id: string, text: string, adminName: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const notes = Array.isArray(user.crmNotes)
      ? [...(user.crmNotes as any[])]
      : [];
    notes.push({ text, createdAt: new Date().toISOString(), adminName });

    const updated = await this.prisma.user.update({
      where: { id },
      data: { crmNotes: notes },
    });

    return this.mapUser(updated);
  }

  async findOne(id: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.mapUser(user);
  }

  async createUser(data: any): Promise<any> {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const hashedPassword = await bcrypt.hash(data.password || 'DRide1234!', 12);
    const isActive = data.status !== undefined ? data.status === 'ACTIVE' : (data.isActive !== undefined ? data.isActive : true);
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        role: (data.role || 'PASSENGER').toUpperCase() as Role,
        avatarUrl: data.avatarUrl,
        isActive,
        crmNotes: data.crmNotes || [],
      },
    });
    return this.mapUser(user);
  }

  async updateUser(id: string, data: any): Promise<any> {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }
    const updateData = { ...data };
    if (updateData.role) {
      updateData.role = updateData.role.toUpperCase() as Role;
    }
    if (updateData.status !== undefined) {
      updateData.isActive = updateData.status === 'ACTIVE';
      delete updateData.status;
    }
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
      });
      return this.mapUser(user);
    } catch (err) {
      throw new NotFoundException('User not found');
    }
  }

  async deleteUser(id: string): Promise<any> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return { success: true };
    } catch (err) {
      throw new NotFoundException('User not found');
    }
  }
}
