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

      // Fetch permissions for the administrative role from PostgreSQL
      const rolePerm = await this.prisma.rolePermission.findUnique({
        where: { role: userRole as Role },
      });
      if (!rolePerm) {
        return false;
      }
      const userPermissions = (rolePerm.permissions as string[]) || [];
      const method = request.method?.toUpperCase() || 'GET';

      // 1. Routes
      if (resource === 'routes') {
        if (method === 'GET') {
          return ['routes', 'analytics', 'finance-calculator', 'trips'].some(
            (p) => userPermissions.includes(p),
          );
        }
        return userPermissions.includes('routes');
      }

      // 2. Trips
      if (resource === 'trips') {
        if (method === 'GET') {
          return ['trips', 'analytics', 'finance-calculator'].some((p) =>
            userPermissions.includes(p),
          );
        }
        return userPermissions.includes('trips');
      }

      // 3. Bookings & Refunds
      if (resource === 'bookings') {
        if (path.includes('/refund')) {
          return userPermissions.includes('refunds');
        }
        if (method === 'GET') {
          return ['bookings', 'payments', 'refunds', 'analytics'].some((p) =>
            userPermissions.includes(p),
          );
        }
        return userPermissions.includes('bookings');
      }

      // 4. Users (Drivers, Passengers, CRM, and Role Permissions)
      if (resource === 'users') {
        if (path.includes('/role-permissions')) {
          return userPermissions.includes('settings');
        }
        const roleQuery = request.query?.role?.toUpperCase();
        if (roleQuery === 'PASSENGER') {
          return userPermissions.includes('passengers');
        }
        if (roleQuery === 'DRIVER') {
          return userPermissions.includes('drivers');
        }
        return userPermissions.includes('crm');
      }

      // 5. Support Tickets
      if (resource === 'support') {
        return userPermissions.includes('support-tickets');
      }

      // 6. Partners
      if (resource === 'partners') {
        return userPermissions.includes('partners');
      }

      // 7. Fallback check for any other resource
      return userPermissions.includes(resource.toLowerCase());
    }

    // Otherwise, check if user's role matches one of the required roles
    return requiredRoles.includes(user.role);
  }
}
