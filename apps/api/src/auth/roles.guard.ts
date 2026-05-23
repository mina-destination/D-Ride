import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY } from './roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
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

      // Fetch permissions for the administrative role from PostgreSQL
      const rolePerm = await this.prisma.rolePermission.findUnique({
        where: { role: userRole as Role },
      });
      if (!rolePerm) {
        return false;
      }

      return (rolePerm.permissions as string[]).includes(permissionRequired.toLowerCase());
    }

    // Otherwise, check if user's role matches one of the required roles
    return requiredRoles.includes(user.role);
  }
}
