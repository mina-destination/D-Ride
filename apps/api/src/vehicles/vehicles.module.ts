import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehiclesGateway } from './vehicles.gateway';
import {
  LiveVehicleLocation,
  LiveVehicleLocationSchema,
} from '../schemas/live-vehicle-location.schema';
import { VehicleEntity, VehicleSchema } from '../schemas/vehicle.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LiveVehicleLocation.name, schema: LiveVehicleLocationSchema },
      { name: VehicleEntity.name, schema: VehicleSchema },
    ]),
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclesGateway],
  exports: [VehiclesService],
})
export class VehiclesModule {}
