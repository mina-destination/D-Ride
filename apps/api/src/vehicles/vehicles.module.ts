import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehiclesGateway } from './vehicles.gateway';
import { StaleLocationCron } from './stale-location.cron';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclesGateway, StaleLocationCron],
  exports: [VehiclesService, VehiclesGateway],
})
export class VehiclesModule {}
