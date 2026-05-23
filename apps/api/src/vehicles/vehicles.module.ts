import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehiclesGateway } from './vehicles.gateway';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclesGateway],
  exports: [VehiclesService],
})
export class VehiclesModule {}
