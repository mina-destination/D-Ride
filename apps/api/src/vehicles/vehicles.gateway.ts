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
import {
  Logger,
  Inject,
  forwardRef,
  CanActivate,
  ExecutionContext,
  Injectable,
  UseGuards,
  OnModuleDestroy,
} from '@nestjs/common';
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
  path: '/api/socket.io',
  cors: {
    origin: (() => {
      const isProduction = process.env.NODE_ENV === 'production';
      const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
      let origins: string[] = [];

      if (allowedOriginsEnv) {
        origins = allowedOriginsEnv.split(',').map((o) => o.trim());
        if (isProduction) {
          origins = origins.filter(
            (o) =>
              !o.includes('localhost') &&
              !o.includes('127.0.0.1') &&
              o !== 'capacitor://localhost',
          );
        }
      } else {
        if (isProduction) {
          throw new Error(
            'ALLOWED_ORIGINS environment variable is required in production',
          );
        }
        origins = [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
          'http://localhost:3001',
        ];
      }

      // Allow Capacitor mobile app localhost origins in both dev and production
      // (Capacitor apps send requests from https://localhost or capacitor://localhost)
      if (!origins.includes('https://localhost')) {
        origins.push('https://localhost');
      }
      if (!origins.includes('capacitor://localhost')) {
        origins.push('capacitor://localhost');
      }
      if (!origins.includes('http://localhost')) {
        origins.push('http://localhost');
      }

      // Always allow D-Ride production/staging domains
      const prodOrigins = [
        'https://d-ride.net',
        'https://admin.d-ride.net',
        'https://api.d-ride.net',
        'https://passenger.d-ride.net',
        'https://driver.d-ride.net',
      ];
      prodOrigins.forEach((o) => {
        if (!origins.includes(o)) {
          origins.push(o);
        }
      });

      return origins;
    })(),
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 5000,
})
export class VehiclesGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VehiclesGateway.name);
  private redisClient: RedisClientType;
  private rateLimitCleanupInterval: ReturnType<typeof setInterval> | null =
    null;
  private readonly memoryFallbackStore = new Map<string, string>();

  constructor(
    @Inject(forwardRef(() => VehiclesService))
    private readonly vehiclesService: VehiclesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.redisClient = createClient({
      url: redisUrl,
      disableOfflineQueue: true,
    });
    this.redisClient.connect().catch((err) => {
      this.logger.error(
        `VehiclesGateway failed to connect to Redis: ${err.message}`,
      );
    });
  }

  private async getRedisValue(key: string): Promise<string | null> {
    if (this.redisClient.isReady) {
      try {
        return await this.redisClient.get(key);
      } catch (err: any) {
        this.logger.error(`Redis get error for key ${key}: ${err.message}`);
      }
    }
    return this.memoryFallbackStore.get(key) || null;
  }

  private async setRedisValue(key: string, value: string): Promise<void> {
    if (this.redisClient.isReady) {
      try {
        await this.redisClient.set(key, value);
        return;
      } catch (err: any) {
        this.logger.error(`Redis set error for key ${key}: ${err.message}`);
      }
    }
    this.memoryFallbackStore.set(key, value);
  }

  private async delRedisValue(key: string): Promise<void> {
    if (this.redisClient.isReady) {
      try {
        await this.redisClient.del(key);
        return;
      } catch (err: any) {
        this.logger.error(`Redis del error for key ${key}: ${err.message}`);
      }
    }
    this.memoryFallbackStore.delete(key);
  }

  afterInit(server: Server) {
    // Rate limiter: max 30 messages per minute per connection
    const rateLimitMap = new Map<
      string,
      { count: number; resetTime: number }
    >();
    const RATE_LIMIT = 30;
    const RATE_WINDOW_MS = 60 * 1000;

    server.use((socket: any, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization;
        if (!token) {
          this.logger.warn(`WS auth failed: Token missing from ${socket.id}`);
          socket.disconnect(true);
          return;
        }
        const cleanToken = token.startsWith('Bearer ')
          ? token.split(' ')[1]
          : token;
        const secret = this.configService.getOrThrow<string>('jwt.secret');
        const payload = this.jwtService.verify(cleanToken, { secret });

        socket.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        };
        next();
      } catch (err) {
        this.logger.warn(`WS auth failed: ${err.message} from ${socket.id}`);
        socket.disconnect(true);
      }
    });

    // Rate limiting middleware for messages
    server.use((socket: any, next) => {
      const now = Date.now();
      const userId = socket.user?.id || socket.id;
      const record = rateLimitMap.get(userId);

      if (!record || now > record.resetTime) {
        rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW_MS });
      } else {
        record.count++;
        if (record.count > RATE_LIMIT) {
          this.logger.warn(`Rate limit exceeded for user ${userId}`);
          socket.disconnect(true);
          return;
        }
      }
      next();
    });

    // Cleanup old entries periodically
    this.rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of rateLimitMap.entries()) {
        if (now > record.resetTime) {
          rateLimitMap.delete(key);
        }
      }
    }, RATE_WINDOW_MS);
  }

  onModuleDestroy() {
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = null;
    }
  }

  handleConnection(client: any) {
    this.logger.log(
      `Client connected: ${client.id} (User: ${client.user?.id})`,
    );

    // If the user has an administrative role, automatically join them to the 'admin' room
    if (
      client.user &&
      ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'OPERATION'].includes(client.user.role)
    ) {
      client.join('admin');
      this.logger.log(`Admin client ${client.id} joined 'admin' room`);
    }

    // Prevent concurrent logins for DRIVER users
    if (client.user?.role === 'DRIVER') {
      const driverId = client.user.id;
      for (const [
        socketId,
        socketInstance,
      ] of this.server.sockets.sockets.entries()) {
        const anySocketInstance = socketInstance as any;
        if (socketId !== client.id && anySocketInstance.user?.id === driverId) {
          this.logger.warn(
            `Concurrent driver login detected: Disconnecting socket ${socketId} for driver ${driverId}`,
          );
          anySocketInstance.emit('sessionExpired', {
            message: 'Your account has been logged in on another device.',
          });
          anySocketInstance.disconnect(true);
        }
      }
    }
  }

  async handleDisconnect(client: any) {
    try {
      const key = `d-ride:active-driver:${client.id}`;
      const driverDataStr = await this.getRedisValue(key);
      if (driverDataStr) {
        const driverData = JSON.parse(driverDataStr) as {
          vehicleId: string;
          driverId: string;
        };
        this.logger.warn(
          `Driver disconnected unexpectedly: socketId=${client.id}, driverId=${driverData.driverId}, vehicleId=${driverData.vehicleId}`,
        );
        client.leave(`vehicle_${driverData.vehicleId}`);
        await this.delRedisValue(key);

        // Check if there is an active trip currently scheduled, boarding, or in transit using this vehicle
        const activeTrip = await this.prisma.trip.findFirst({
          where: {
            vehicleId: driverData.vehicleId,
            status: { in: ['SCHEDULED', 'BOARDING', 'IN_TRANSIT'] },
          },
        });

        if (activeTrip) {
          this.logger.log(
            `Driver disconnected socket, but has active trip ${activeTrip.id}. Keeping vehicle online for background tracking.`,
          );
        } else {
          // Check if native HTTP channel has recently sent updates
          const recentLocation =
            await this.prisma.liveVehicleLocation.findUnique({
              where: { vehicleId: driverData.vehicleId },
            });
          const fiveMinutesAgo = new Date(Date.now() - 300_000);
          if (
            recentLocation?.lastUpdatedAt &&
            recentLocation.lastUpdatedAt > fiveMinutesAgo
          ) {
            this.logger.log(
              `Driver socket disconnected, but native HTTP location updates were active within the last 5m. Keeping vehicle online.`,
            );
          } else {
            await this.vehiclesService.markVehicleOffline(driverData.vehicleId);
          }
        }
      } else {
        this.logger.log(`Client disconnected: ${client.id}`);
      }
    } catch (err: any) {
      this.logger.error(
        `Error handling disconnect for client ${client.id}: ${err.message}`,
      );
    }
  }

  @SubscribeMessage('subscribeToVehicle')
  async handleSubscribeToVehicle(
    @ConnectedSocket() client: any,
    @MessageBody() payload: string | { vehicleId: string; ticketCode?: string },
  ) {
    const user = client.user;
    if (!user) {
      this.logger.error(
        `Unauthorized connection for subscribeToVehicle. Socket ID: ${client.id}`,
      );
      return {
        event: 'subscribed',
        data: { success: false, error: 'Unauthorized' },
      };
    }

    let vehicleId: string;
    let ticketCode: string | undefined;

    if (typeof payload === 'string') {
      vehicleId = payload;
    } else if (payload && typeof payload === 'object') {
      vehicleId = payload.vehicleId;
      ticketCode = payload.ticketCode;
    } else {
      return {
        event: 'subscribed',
        data: { success: false, error: 'Invalid payload format' },
      };
    }

    const isAdmin = ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'OPERATION'].includes(
      user.role,
    );

    if (user.role === 'PASSENGER') {
      let hasAccess = false;

      // 1. Check if user has their own booking
      const ownBooking = await this.prisma.booking.findFirst({
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

      if (ownBooking) {
        hasAccess = true;
      } else if (ticketCode) {
        // 2. Check if shared ticketCode matches
        const sharedBooking = await this.prisma.booking.findFirst({
          where: {
            id: ticketCode,
            status: {
              in: [BookingStatus.CONFIRMED, BookingStatus.BOARDED],
            },
            trip: {
              vehicleId: vehicleId,
            },
          },
        });
        if (sharedBooking) {
          hasAccess = true;
        }
      }

      if (!hasAccess && !isAdmin) {
        this.logger.warn(
          `Access Denied: Passenger user ${user.id} attempted to subscribe to vehicle ${vehicleId} telemetry without a confirmed/boarded booking or valid shared ticketCode`,
        );
        return {
          event: 'subscribed',
          data: {
            success: false,
            error:
              'Access Denied: No active booking or valid ticket code for this vehicle',
          },
        };
      }
    } else if (!isAdmin && user.role !== 'DRIVER') {
      this.logger.warn(
        `Access Denied: User ${user.id} with role ${user.role} attempted to subscribe to vehicle ${vehicleId} telemetry`,
      );
      return {
        event: 'subscribed',
        data: { success: false, error: 'Access Denied' },
      };
    }

    this.logger.log(
      `Client ${client.id} (User: ${user.id}, Role: ${user.role}) subscribed to vehicle ${vehicleId}`,
    );
    client.join(`vehicle_${vehicleId}`);

    // Fetch and send current arrived checkpoints to the subscribing client
    try {
      const arrivedStr = await this.getRedisValue(
        `d-ride:arrived-checkpoints:${vehicleId}`,
      );
      if (arrivedStr) {
        client.emit('checkpointUpdate', {
          vehicleId,
          arrivedCheckpoints: JSON.parse(arrivedStr),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to fetch arrived checkpoints on subscribe: ${err.message}`,
      );
    }

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
      speed?: number | null;
      heading?: number | null;
      battery?: number | null;
    },
  ) {
    const user = client.user;
    if (!user || !user.id || user.role !== 'DRIVER') {
      this.logger.error(
        `Unauthorized driverLocationPush attempt. Socket ID: ${client.id}`,
      );
      client.disconnect(true);
      return {
        event: 'locationAck',
        data: { success: false, error: 'Unauthorized role' },
      };
    }

    const driverId = user.id;
    const vehicleId = data.vehicleId;

    // Verify driver is assigned to this vehicle OR has an active/upcoming trip using this vehicle
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) {
      this.logger.error(`Vehicle ${vehicleId} not found`);
      return {
        event: 'locationAck',
        data: { success: false, error: 'Vehicle not found' },
      };
    }

    let isAuthorized = vehicle.driverId === driverId;

    if (!isAuthorized) {
      const activeTrip = await this.prisma.trip.findFirst({
        where: {
          vehicleId: vehicleId,
          driverId: driverId,
          status: { in: ['SCHEDULED', 'BOARDING', 'IN_TRANSIT'] },
        },
      });
      if (activeTrip) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      this.logger.error(
        `Driver ${driverId} attempted to push location for unauthorized vehicle ${vehicleId}`,
      );
      return {
        event: 'locationAck',
        data: {
          success: false,
          error: 'Access Denied: Not your assigned vehicle or active trip',
        },
      };
    }

    try {
      const key = `d-ride:active-driver:${client.id}`;
      await this.setRedisValue(
        key,
        JSON.stringify({
          vehicleId,
          driverId,
          longitude: data.longitude,
          latitude: data.latitude,
          speed: data.speed ?? 0,
          heading: data.heading ?? 0,
          battery: data.battery ?? null,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch (err: any) {
      this.logger.error(`Failed to map active driver: ${err.message}`);
    }
    client.join(`vehicle_${vehicleId}`);

    try {
      await this.vehiclesService.upsertLocation({
        vehicleId,
        driverId,
        longitude: data.longitude,
        latitude: data.latitude,
        speedKmh: data.speed ?? 0,
        headingDegrees: data.heading ?? 0,
        batteryPercentage: data.battery ?? undefined,
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

  @SubscribeMessage('driverCheckpointUpdate')
  async handleDriverCheckpointUpdate(
    @ConnectedSocket() client: any,
    @MessageBody()
    data: {
      vehicleId: string;
      arrivedCheckpoints: string[];
    },
  ) {
    const user = client.user;
    if (!user || user.role !== 'DRIVER') {
      return {
        event: 'checkpointUpdateAck',
        data: { success: false, error: 'Unauthorized role' },
      };
    }

    this.logger.log(
      `Driver ${user.id} updated arrived checkpoints for vehicle ${data.vehicleId}: ${JSON.stringify(data.arrivedCheckpoints)}`,
    );

    try {
      await this.setRedisValue(
        `d-ride:arrived-checkpoints:${data.vehicleId}`,
        JSON.stringify(data.arrivedCheckpoints),
      );
    } catch (err: any) {
      this.logger.error(`Failed to save arrived checkpoints: ${err.message}`);
    }

    this.server.to(`vehicle_${data.vehicleId}`).emit('checkpointUpdate', {
      vehicleId: data.vehicleId,
      arrivedCheckpoints: data.arrivedCheckpoints,
      timestamp: new Date().toISOString(),
    });

    return { event: 'checkpointUpdateAck', data: { success: true } };
  }

  @SubscribeMessage('driverEmergencyPanic')
  async handleDriverEmergencyPanic(
    @ConnectedSocket() client: any,
    @MessageBody()
    data: {
      tripId: string;
      vehicleId: string;
      latitude: number;
      longitude: number;
      driverName: string;
      plateNumber: string;
    },
  ) {
    const user = client.user;
    if (!user || user.role !== 'DRIVER') {
      return {
        event: 'driverEmergencyPanicAck',
        data: { success: false, error: 'Unauthorized role' },
      };
    }

    this.logger.error(
      `EMERGENCY PANIC RECEIVED from Driver ${user.id} (${data.driverName}) for vehicle ${data.vehicleId} on trip ${data.tripId}`,
    );

    const payload = {
      ...data,
      driverId: user.id,
      timestamp: new Date().toISOString(),
    };

    // Broadcast the panic payload to all connected administrative rooms
    this.server.to('admin').emit('driverEmergencyPanic', payload);

    // Also broadcast to the vehicle room
    this.server
      .to(`vehicle_${data.vehicleId}`)
      .emit('driverEmergencyPanic', payload);

    return { event: 'driverEmergencyPanicAck', data: { success: true } };
  }

  async getArrivedCheckpoints(vehicleId: string): Promise<string[]> {
    const arrivedStr = await this.getRedisValue(
      `d-ride:arrived-checkpoints:${vehicleId}`,
    );
    return arrivedStr ? JSON.parse(arrivedStr) : [];
  }

  async setArrivedCheckpoints(
    vehicleId: string,
    arrivedCheckpoints: string[],
  ): Promise<void> {
    await this.setRedisValue(
      `d-ride:arrived-checkpoints:${vehicleId}`,
      JSON.stringify(arrivedCheckpoints),
    );
    if (this.server) {
      this.server.to(`vehicle_${vehicleId}`).emit('checkpointUpdate', {
        vehicleId,
        arrivedCheckpoints,
        timestamp: new Date().toISOString(),
      });
    }
  }

  emitTripStatusUpdate(
    vehicleId: string,
    data: { tripId: string; status: string },
  ): void {
    if (this.server) {
      this.server.to(`vehicle_${vehicleId}`).emit('tripStatusUpdate', data);
    }
  }

  emitEtaUpdate(
    vehicleId: string,
    data: {
      vehicleId: string;
      nextCheckpoint: string;
      etaMinutes: number;
      distanceMeters: number;
      timestamp: string;
    },
  ): void {
    if (this.server) {
      this.server.to(`vehicle_${vehicleId}`).emit('etaUpdate', data);
    }
  }
}
