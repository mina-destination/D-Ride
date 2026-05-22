import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LiveVehicleLocation,
  LiveVehicleLocationDocument,
} from '../schemas/live-vehicle-location.schema';
import { VehicleEntity, VehicleDocument } from '../schemas/vehicle.schema';
import { VehiclesGateway } from './vehicles.gateway';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    @InjectModel(LiveVehicleLocation.name)
    private locationModel: Model<LiveVehicleLocationDocument>,
    @InjectModel(VehicleEntity.name)
    private vehicleModel: Model<VehicleDocument>,
    private vehiclesGateway: VehiclesGateway,
  ) {}

  // --- Fleet Management CRUD ---

  async findAllVehicles(): Promise<VehicleEntity[]> {
    return this.vehicleModel.find().sort({ createdAt: -1 }).exec();
  }

  async createVehicle(data: Partial<VehicleEntity>): Promise<VehicleEntity> {
    const vehicle = new this.vehicleModel(data);
    return vehicle.save();
  }

  async updateVehicle(
    id: string,
    data: Partial<VehicleEntity>,
  ): Promise<VehicleEntity> {
    const vehicle = await this.vehicleModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async deleteVehicle(id: string): Promise<any> {
    const vehicle = await this.vehicleModel.findByIdAndDelete(id).exec();
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  // --- Live Location Tracking ---

  async upsertLocation(data: {
    vehicleId: string;
    driverId: string;
    longitude: number;
    latitude: number;
  }): Promise<LiveVehicleLocationDocument> {
    this.logger.log(`Updating location for vehicle ${data.vehicleId}`);
    const updatedLocation = await this.locationModel
      .findOneAndUpdate(
        { vehicleId: data.vehicleId },
        {
          vehicleId: data.vehicleId,
          driverId: data.driverId,
          location: {
            type: 'Point',
            coordinates: [data.longitude, data.latitude],
          },
          createdAt: new Date(),
        },
        { upsert: true, new: true },
      )
      .exec();

    // Broadcast the updated location to connected clients
    this.vehiclesGateway.broadcastVehicleLocation(data.vehicleId, {
      longitude: data.longitude,
      latitude: data.latitude,
    });

    return updatedLocation as LiveVehicleLocationDocument;
  }

  async getLocation(vehicleId: string): Promise<LiveVehicleLocationDocument> {
    const location = await this.locationModel.findOne({ vehicleId }).exec();
    if (!location) {
      throw new NotFoundException(`No live location for vehicle ${vehicleId}`);
    }
    return location;
  }

  async getNearbyVehicles(
    lng: number,
    lat: number,
    radiusMeters: number = 3000,
  ): Promise<LiveVehicleLocationDocument[]> {
    this.logger.log(
      `Finding vehicles near [${lng}, ${lat}] within ${radiusMeters}m`,
    );
    return this.locationModel
      .find({
        location: {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            $maxDistance: radiusMeters,
          },
        },
      })
      .exec();
  }
}
