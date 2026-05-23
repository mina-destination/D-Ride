import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TripEntity, TripDocument } from '../schemas/trip.schema';

@Injectable()
export class TripsService {
  constructor(
    @InjectModel(TripEntity.name) private tripModel: Model<TripDocument>,
  ) {}

  async findAll(): Promise<TripEntity[]> {
    return this.tripModel
      .find()
      .populate('routeId')
      .populate('vehicleId')
      .populate('driverId')
      .exec();
  }

  async findById(id: string): Promise<TripEntity> {
    const trip = await this.tripModel
      .findById(id)
      .populate('routeId')
      .populate('vehicleId')
      .populate('driverId')
      .exec();
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async searchTrips(routeId?: string, date?: string): Promise<TripEntity[]> {
    const query: any = { status: 'SCHEDULED' };
    if (routeId) {
      try {
        query.routeId = new Types.ObjectId(routeId);
      } catch (e) {
        query.routeId = routeId;
      }
    }
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.departureTime = { $gte: startDate, $lte: endDate };
    }
    return this.tripModel
      .find(query)
      .populate('routeId')
      .sort({ departureTime: 1 })
      .exec();
  }

  async create(data: Partial<TripEntity>): Promise<TripEntity> {
    const newTrip = new this.tripModel(data);
    return newTrip.save();
  }

  async update(id: string, data: Partial<TripEntity>): Promise<TripEntity> {
    const trip = await this.tripModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async delete(id: string): Promise<void> {
    const result = await this.tripModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Trip not found');
  }

  async incrementBookedSeats(id: string, count: number): Promise<TripEntity> {
    const trip = await this.tripModel.findById(id).exec();
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.bookedSeats + count > trip.availableSeats) {
      throw new Error('Not enough available seats');
    }
    trip.bookedSeats += count;
    return trip.save();
  }

  async findByDriver(driverId: string): Promise<TripEntity[]> {
    return this.tripModel
      .find({ driverId })
      .populate('routeId')
      .populate('vehicleId')
      .sort({ departureTime: 1 })
      .exec();
  }

  async updateTripStatus(
    tripId: string,
    driverId: string,
    status: string,
  ): Promise<TripEntity> {
    const trip = await this.tripModel.findById(tripId).exec();
    if (!trip) throw new NotFoundException('Trip not found');

    if (trip.driverId && trip.driverId.toString() !== driverId) {
      throw new Error('You are not authorized to update this trip status');
    }

    const validStatuses = [
      'SCHEDULED',
      'BOARDING',
      'IN_TRANSIT',
      'COMPLETED',
      'CANCELLED',
    ];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid trip status');
    }

    trip.status = status;
    if (status === 'COMPLETED') {
      trip.arrivalTime = new Date();
    }

    return trip.save();
  }
}
