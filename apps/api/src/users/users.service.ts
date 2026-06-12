import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
    const defaultPerms = [
      {
        role: Role.SUPER_ADMIN,
        permissions: [
          'dashboard',
          'routes',
          'trips',
          'vehicles',
          'drivers',
          'bookings',
          'refunds',
          'payments',
          'analytics',
          'finance-calculator',
          'passengers',
          'crm',
          'support-tickets',
          'settings',
          'partners',
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
          'refunds',
          'payments',
          'analytics',
          'passengers',
          'crm',
          'support-tickets',
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
          'support-tickets',
        ],
      },
    ];

    try {
      for (const item of defaultPerms) {
        const existing = await this.prisma.rolePermission.findUnique({
          where: { role: item.role },
        });
        if (!existing) {
          await this.prisma.rolePermission.create({
            data: item,
          });
        } else {
          const existingPermissions = (existing.permissions as string[]) || [];
          const merged = Array.from(
            new Set([...existingPermissions, ...item.permissions]),
          );
          if (merged.length !== existingPermissions.length) {
            await this.prisma.rolePermission.update({
              where: { role: item.role },
              data: { permissions: merged },
            });
          }
        }
      }
      console.log('Seeded and verified default role permissions successfully');
    } catch (err) {
      console.error('Failed to seed default role permissions:', err);
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

  async findAllByRole(role: string, limit = 100): Promise<any[]> {
    const roleUpper = role.toUpperCase();
    if (!Object.values(Role).includes(roleUpper as Role)) {
      return [];
    }
    const users = await this.prisma.user.findMany({
      where: { role: roleUpper as Role },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return users.map((user) => this.mapUser(user));
  }

  async findAll(limit = 100): Promise<any[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return users.map((user) => this.mapUser(user));
  }

  async findPaginated(role?: string, skip = 0, take = 20): Promise<any> {
    const roleUpper = role?.toUpperCase();
    if (roleUpper && !Object.values(Role).includes(roleUpper as Role)) {
      return {
        users: [],
        total: 0,
        page: Math.floor(skip / take) + 1,
        limit: take,
      };
    }
    const where = roleUpper ? { role: roleUpper as Role } : {};
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      users: users.map((user) => this.mapUser(user)),
      total,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
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

  async createUser(data: CreateUserDto): Promise<any> {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const hashedPassword = await bcrypt.hash(data.password || 'DRide1234!', 12);
    const isActive =
      data.status !== undefined
        ? data.status === 'ACTIVE'
        : data.isActive !== undefined
          ? data.isActive
          : true;
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

  async updateUser(id: string, data: UpdateUserDto): Promise<any> {
    // Allowlist only safe fields to prevent mass assignment of walletBalance, crmNotes, etc.
    const allowedFields = [
      'name',
      'email',
      'phone',
      'password',
      'role',
      'avatarUrl',
      'isActive',
      'status',
    ] as const;
    const updateData: Record<string, any> = {};
    for (const key of allowedFields) {
      if (data[key as keyof UpdateUserDto] !== undefined) {
        updateData[key] = data[key as keyof UpdateUserDto];
      }
    }

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
    }
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
