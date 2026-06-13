import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesGateway } from './vehicles.gateway';

@Injectable()
export class StaleLocationCron {
  private readonly logger = new Logger(StaleLocationCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesGateway: VehiclesGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleStaleLocations() {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    try {
      const staleLocations = await this.prisma.liveVehicleLocation.findMany({
        where: {
          lastUpdatedAt: { lt: staleThreshold },
          status: 'ACTIVE',
        },
      });

      if (staleLocations.length === 0) return;

      this.logger.log(
        `Marking ${staleLocations.length} vehicle(s) as OFFLINE (no update for 5+ minutes)`,
      );

      await this.prisma.liveVehicleLocation.updateMany({
        where: {
          id: { in: staleLocations.map((l) => l.id) },
        },
        data: {
          status: 'OFFLINE',
        },
      });

      // Emit vehicleOffline event for each stale vehicle
      for (const loc of staleLocations) {
        this.vehiclesGateway.server
          .to(`vehicle_${loc.vehicleId}`)
          .emit('vehicleOffline', {
            vehicleId: loc.vehicleId,
            lastSeen: loc.lastUpdatedAt.toISOString(),
            timestamp: new Date().toISOString(),
          });
      }
    } catch (err: any) {
      this.logger.error(`Stale location cleanup failed: ${err.message}`);
    }
  }
}
