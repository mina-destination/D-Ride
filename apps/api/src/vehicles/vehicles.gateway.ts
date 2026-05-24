import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  pingTimeout: 30000,
  pingInterval: 5000,
})
export class VehiclesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VehiclesGateway.name);
  private readonly activeDrivers = new Map<string, { vehicleId: string; driverId: string }>();

  constructor(
    @Inject(forwardRef(() => VehiclesService))
    private readonly vehiclesService: VehiclesService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
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
