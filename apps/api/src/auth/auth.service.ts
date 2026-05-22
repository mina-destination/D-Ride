import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserDocument } from '../schemas/user.schema';
import {
  RolePermission,
  RolePermissionDocument,
} from '../schemas/role-permission.schema';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(UserEntity.name) private userModel: Model<UserDocument>,
    @InjectModel(RolePermission.name)
    private rolePermissionModel: Model<RolePermissionDocument>,
    private jwtService: JwtService,
  ) {}

  async getPermissionsForRole(role: string): Promise<string[]> {
    if (role === 'OWNER') {
      return [
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
      ];
    }
    const rolePerm = await this.rolePermissionModel
      .findOne({ role: role.toUpperCase() })
      .exec();
    return rolePerm ? rolePerm.permissions : [];
  }

  async register(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role?: string;
  }) {
    const existing = await this.userModel.findOne({ email: data.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = await this.userModel.create({
      ...data,
      password: hashedPassword,
      role: data.role || 'PASSENGER',
    });

    this.logger.log(`User registered: ${user.email} (${user.role})`);

    const payload = { sub: user._id, email: user.email, role: user.role };
    const permissions = await this.getPermissionsForRole(user.role);
    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
  }

  async login(user: any) {
    const payload = { sub: user._id, email: user.email, role: user.role };
    this.logger.log(`User logged in: ${user.email}`);
    const permissions = await this.getPermissionsForRole(user.role);
    return {
      user: {
        ...user,
        permissions,
      },
      accessToken: this.jwtService.sign(payload),
    };
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).select('-password');
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const permissions = await this.getPermissionsForRole(user.role);
    return {
      ...user.toObject(),
      permissions,
    };
  }
}
