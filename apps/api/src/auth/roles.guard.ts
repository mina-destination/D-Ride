import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ROLES_KEY } from './roles.decorator';
import {
  RolePermission,
  RolePermissionDocument,
} from '../schemas/role-permission.schema';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(RolePermission.name)
    private rolePermissionModel: Model<RolePermissionDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user || !user.role) {
      return false;
    }

    const userRole = user.role.toUpperCase();

    // Owner always has full access
    if (userRole === 'OWNER') {
      return true;
    }

    // Check if the route allows any administrative role
    const isAdminRoute = requiredRoles.some((role) =>
      ['ADMIN', 'SUPER_ADMIN', 'OPERATION'].includes(role.toUpperCase()),
    );

    if (isAdminRoute) {
      const isUserAdmin = ['SUPER_ADMIN', 'ADMIN', 'OPERATION'].includes(
        userRole,
      );

      if (!isUserAdmin) {
        // Fall back for cases like @Roles('DRIVER', 'ADMIN') when user is DRIVER
        return requiredRoles.includes(user.role);
      }

      // Determine required permission based on the path
      const path = request.path || request.url;
      const parts = path.replace(/^\//, '').split('/');
      const resource = parts[0] === 'api' ? parts[1] : parts[0];

      let permissionRequired = resource;

      if (resource === 'users') {
        if (path.includes('/role-permissions')) {
          permissionRequired = 'settings';
        } else {
          const roleQuery = request.query?.role?.toUpperCase();
          if (roleQuery === 'PASSENGER') {
            permissionRequired = 'passengers';
          } else if (roleQuery === 'DRIVER') {
            permissionRequired = 'drivers';
          } else {
            permissionRequired = 'crm';
          }
        }
      } else if (resource === 'support') {
        permissionRequired = 'crm';
      }

      if (!permissionRequired) {
        return false;
      }

      // Fetch permissions for the administrative role from MongoDB
      const rolePerm = await this.rolePermissionModel
        .findOne({ role: userRole })
        .exec();
      if (!rolePerm) {
        return false;
      }

      return rolePerm.permissions.includes(permissionRequired.toLowerCase());
    }

    // Otherwise, check if user's role matches one of the required roles
    return requiredRoles.includes(user.role);
  }
}
