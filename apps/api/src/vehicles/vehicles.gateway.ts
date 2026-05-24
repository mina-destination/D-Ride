import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

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
  private readonly activeDrivers = new Map<string, { vehicleId: string; driverId: string }>();

  constructor(
    @Inject(forwardRef(() => VehiclesService))
    private readonly vehiclesService: VehiclesService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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

  handleDisconnect(client: Socket) {
    const driverData = this.activeDrivers.get(client.id);
    if (driverData) {
      this.logger.warn(
        `Driver disconnected unexpectedly: socketId=${client.id}, driverId=${driverData.driverId}, vehicleId=${driverData.vehicleId}`,
      );
      client.leave(`vehicle_${driverData.vehicleId}`);
      this.activeDrivers.delete(client.id);
      
      this.vehiclesService.markVehicleOffline(driverData.vehicleId).catch((err) => {
        this.logger.error(`Failed to mark vehicle offline on socket disconnect: ${err.message}`);
      });
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }

  @SubscribeMessage('subscribeToVehicle')
  handleSubscribeToVehicle(client: Socket, @MessageBody() vehicleId: string) {
    this.logger.log(`Client ${client.id} subscribed to vehicle ${vehicleId}`);
    client.join(`vehicle_${vehicleId}`);
    return { event: 'subscribed', data: vehicleId };
  }

  @SubscribeMessage('unsubscribeFromVehicle')
  handleUnsubscribeFromVehicle(
    client: Socket,
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
    client: Socket,
    @MessageBody()
    data: {
      vehicleId: string;
      driverId: string;
      longitude: number;
      latitude: number;
    },
  ) {
    try {
      this.activeDrivers.set(client.id, {
        vehicleId: data.vehicleId,
        driverId: data.driverId,
      });
      client.join(`vehicle_${data.vehicleId}`);
      
      await this.vehiclesService.upsertLocation(data);
      return { event: 'locationAck', data: { success: true } };
    } catch (e: any) {
      this.logger.error(`Failed to handle location push: ${e.message}`);
      return {
        event: 'locationAck',
        data: { success: false, error: e.message },
      };
    }
  }
}
