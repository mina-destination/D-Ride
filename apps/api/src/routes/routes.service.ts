import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Route, RouteDocument } from '../schemas/route.schema';
import { StopEntity } from '../schemas/stop.schema';

function getDistance(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @InjectModel(Route.name) private routeModel: Model<RouteDocument>,
  ) {}

  async findAll(): Promise<RouteDocument[]> {
    this.logger.log('Fetching all routes');
    return this.routeModel.find().exec();
  }

  async findById(id: string): Promise<RouteDocument> {
    const route = await this.routeModel.findById(id).exec();
    if (!route) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
    return route;
  }

  async create(data: Partial<Route>): Promise<RouteDocument> {
    this.logger.log(`Creating route: ${data.name}`);
    return this.routeModel.create(data);
  }

  async update(id: string, data: Partial<Route>): Promise<RouteDocument> {
    const route = await this.routeModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!route) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
    return route;
  }

  async delete(id: string): Promise<void> {
    const result = await this.routeModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
  }

  async findNearby(
    lng: number,
    lat: number,
    radiusMeters: number = 5000,
  ): Promise<RouteDocument[]> {
    this.logger.log(
      `Finding routes near [${lng}, ${lat}] within ${radiusMeters}m`,
    );
    return this.routeModel
      .find({
        path: {
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

  async findNearestCheckpoint(
    id: string,
    lng: number,
    lat: number,
  ): Promise<StopEntity | null> {
    const route = await this.findById(id);
    if (!route || !route.checkpoints || route.checkpoints.length === 0) {
      return null;
    }

    let closest: StopEntity | null = null;
    let minDistance = Infinity;

    for (const checkpoint of route.checkpoints) {
      if (!checkpoint.location || !checkpoint.location.coordinates) continue;
      const [cpLng, cpLat] = checkpoint.location.coordinates;
      const distance = getDistance(lng, lat, cpLng, cpLat);
      if (distance < minDistance) {
        minDistance = distance;
        closest = checkpoint;
      }
    }

    return closest;
  }
}
