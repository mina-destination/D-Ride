import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../schemas/user.schema';
import {
  RolePermission,
  RolePermissionDocument,
} from '../schemas/role-permission.schema';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RolePermission.name)
    private rolePermissionModel: Model<RolePermissionDocument>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultPermissions();
  }

  private async seedDefaultPermissions() {
    const count = await this.rolePermissionModel.countDocuments();
    if (count === 0) {
      await this.rolePermissionModel.create([
        {
          role: 'SUPER_ADMIN',
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
          role: 'ADMIN',
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
          role: 'OPERATION',
          permissions: [
            'dashboard',
            'routes',
            'trips',
            'vehicles',
            'drivers',
            'bookings',
          ],
        },
      ]);
      console.log('Seeded default role permissions successfully');
    }
  }

  async getRolePermissions(): Promise<RolePermission[]> {
    return this.rolePermissionModel.find().exec();
  }

  async updateRolePermissions(
    role: string,
    permissions: string[],
  ): Promise<RolePermission> {
    const updated = await this.rolePermissionModel
      .findOneAndUpdate(
        { role: role.toUpperCase() },
        { permissions },
        { new: true, upsert: true },
      )
      .exec();
    return updated;
  }

  async findAllByRole(role: string): Promise<User[]> {
    return this.userModel
      .find({ role })
      .select('-password')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAll(): Promise<User[]> {
    return this.userModel
      .find()
      .select('-password')
      .sort({ createdAt: -1 })
      .exec();
  }

  async addCrmNote(id: string, text: string, adminName: string): Promise<User> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    if (!user.crmNotes) {
      user.crmNotes = [];
    }
    user.crmNotes.push({ text, createdAt: new Date(), adminName });
    await user.save();

    const result = user.toObject();
    delete (result as any).password;
    return result as User;
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findById(id).select('-password').exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async createUser(data: any): Promise<User> {
    const existing = await this.userModel.findOne({ email: data.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const hashedPassword = await bcrypt.hash(data.password || 'DRide1234!', 12);
    const user = await this.userModel.create({
      ...data,
      password: hashedPassword,
    });
    const result = user.toObject();
    delete (result as any).password;
    return result as User;
  }

  async updateUser(
    id: string,
    data: Partial<User> & { password?: string },
  ): Promise<User> {
    if (data.password) {
      (data as any).password = await bcrypt.hash(data.password, 12);
    }
    const user = await this.userModel
      .findByIdAndUpdate(id, data, { new: true })
      .select('-password')
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async deleteUser(id: string): Promise<any> {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return { success: true };
  }
}
