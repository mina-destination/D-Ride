import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef, CanActivate, ExecutionContext, Injectable, UseGuards } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';
import { WsException } from '@nestjs/websockets';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class WsJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    if (!client.user) {
      throw new WsException('Unauthorized WebSocket connection');
    }
    return true;
  }
}

@UseGuards(WsJwtGuard)
@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
          'http://localhost:3001',
        ],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 5000,
})
export class VehiclesGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VehiclesGateway.name);
  private redisClient: RedisClientType;

  constructor(
    @Inject(forwardRef(() => VehiclesService))
    private readonly vehiclesService: VehiclesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redisClient = createClient({ url: redisUrl }) as RedisClientType;
    this.redisClient.connect().catch((err) => {
      this.logger.error(`VehiclesGateway failed to connect to Redis: ${err.message}`);
    });
  }

  afterInit(server: Server) {
    server.use((socket: any, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization;
        if (!token) {
          return next(new Error('Unauthorized: Token missing'));
        }
        const cleanToken = token.startsWith('Bearer ')
          ? token.split(' ')[1]
          : token;
        const secret =
          this.configService.get<string>('jwt.secret') ||
          'dev_jwt_secret_do_not_use_in_production';
        const payload = this.jwtService.verify(cleanToken, { secret });

        socket.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        };
        next();
      } catch (err) {
        next(new Error('Unauthorized: Invalid or expired token'));
      }
    });
  }

  handleConnection(client: any) {
    this.logger.log(`Client connected: ${client.id} (User: ${client.user?.id})`);
  }

  async handleDisconnect(client: any) {
    try {
      const key = `d-ride:active-driver:${client.id}`;
      const driverDataStr = await this.redisClient.get(key);
      if (driverDataStr) {
        const driverData = JSON.parse(driverDataStr) as { vehicleId: string; driverId: string };
        this.logger.warn(
          `Driver disconnected unexpectedly: socketId=${client.id}, driverId=${driverData.driverId}, vehicleId=${driverData.vehicleId}`,
        );
        client.leave(`vehicle_${driverData.vehicleId}`);
        await this.redisClient.del(key);
        
        await this.vehiclesService.markVehicleOffline(driverData.vehicleId);
      } else {
        this.logger.log(`Client disconnected: ${client.id}`);
      }
    } catch (err: any) {
      this.logger.error(`Error handling disconnect for client ${client.id}: ${err.message}`);
    }
  }

  @SubscribeMessage('subscribeToVehicle')
  async handleSubscribeToVehicle(
    @ConnectedSocket() client: any,
    @MessageBody() vehicleId: string,
  ) {
    const user = client.user;
    if (!user) {
      this.logger.error(`Unauthorized connection for subscribeToVehicle. Socket ID: ${client.id}`);
      return { event: 'subscribed', data: { success: false, error: 'Unauthorized' } };
    }

    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'OPERATION'].includes(user.role);

    if (user.role === 'PASSENGER') {
      const booking = await this.prisma.booking.findFirst({
        where: {
          userId: user.id,
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.BOARDED],
          },
          trip: {
            vehicleId: vehicleId,
          },
        },
      });

      if (!booking && !isAdmin) {
        this.logger.warn(
          `Access Denied: Passenger user ${user.id} attempted to subscribe to vehicle ${vehicleId} telemetry without a confirmed/boarded booking`,
        );
        return { event: 'subscribed', data: { success: false, error: 'Access Denied: No active booking for this vehicle' } };
      }
    } else if (!isAdmin && user.role !== 'DRIVER') {
      this.logger.warn(
        `Access Denied: User ${user.id} with role ${user.role} attempted to subscribe to vehicle ${vehicleId} telemetry`,
      );
      return { event: 'subscribed', data: { success: false, error: 'Access Denied' } };
    }

    this.logger.log(`Client ${client.id} (User: ${user.id}, Role: ${user.role}) subscribed to vehicle ${vehicleId}`);
    client.join(`vehicle_${vehicleId}`);
    return { event: 'subscribed', data: vehicleId };
  }

  @SubscribeMessage('unsubscribeFromVehicle')
  handleUnsubscribeFromVehicle(
    @ConnectedSocket() client: Socket,
    @MessageBody() vehicleId: string,
  ) {
    this.logger.log(
      `Client ${client.id} unsubscribed from vehicle ${vehicleId}`,
    );
    client.leave(`vehicle_${vehicleId}`);
    return { event: 'unsubscribed', data: vehicleId };
  }

  broadcastVehicleLocation(vehicleId: string, location: any) {
    this.server.to(`vehicle_${vehicleId}`).emit('vehicleLocationUpdate', {
      vehicleId,
      location,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('driverLocationPush')
  async handleDriverLocationPush(
    @ConnectedSocket() client: any,
    @MessageBody()
    data: {
      vehicleId: string;
      longitude: number;
      latitude: number;
    },
  ) {
    const user = client.user;
    if (!user || user.role !== 'DRIVER') {
      this.logger.error(`Unauthorized driverLocationPush attempt. Socket ID: ${client.id}`);
      client.disconnect(true);
      return { event: 'locationAck', data: { success: false, error: 'Unauthorized role' } };
    }

    const driverId = user.id;
    const vehicleId = data.vehicleId;

    try {
      const key = `d-ride:active-driver:${client.id}`;
      await this.redisClient.set(key, JSON.stringify({ vehicleId, driverId }));
      client.join(`vehicle_${vehicleId}`);
    } catch (err: any) {
      this.logger.error(`Failed to map active driver to Redis: ${err.message}`);
    }

    try {
      await this.vehiclesService.upsertLocation({
        vehicleId,
        driverId,
        longitude: data.longitude,
        latitude: data.latitude,
      });
      return { event: 'locationAck', data: { success: true } };
    } catch (e: any) {
      this.logger.error(
        `Failed to upsert vehicle location for driver ${driverId} and vehicle ${vehicleId}: ${e.message}`,
        e.stack,
      );
      return {
        event: 'locationAck',
        data: { success: false, error: 'DATABASE_ERROR', message: e.message },
      };
    }
  }
}
