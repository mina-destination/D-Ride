import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<any[]> {
    this.logger.log('Fetching all routes');
    const routes = await this.prisma.route.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return routes.map((r) => ({ ...r, _id: r.id }));
  }

  async findById(id: string): Promise<any> {
    const route = await this.prisma.route.findUnique({ where: { id } });
    if (!route) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
    return { ...route, _id: route.id };
  }

  async create(data: any): Promise<any> {
    this.logger.log(`Creating route: ${data.name}`);
    const route = await this.prisma.route.create({
      data: {
        name: data.name,
        path: data.path,
        coverImage: data.coverImage,
        checkpoints: data.checkpoints || [],
        distanceKm: data.distanceKm || 0,
        estimatedDurationMinutes: data.estimatedDurationMinutes || 0,
      },
    });
    return { ...route, _id: route.id };
  }

  async update(id: string, data: any): Promise<any> {
    try {
      const route = await this.prisma.route.update({
        where: { id },
        data: {
          name: data.name,
          path: data.path,
          coverImage: data.coverImage,
          checkpoints: data.checkpoints,
          distanceKm: data.distanceKm,
          estimatedDurationMinutes: data.estimatedDurationMinutes,
        },
      });
      return { ...route, _id: route.id };
    } catch (err) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.route.delete({ where: { id } });
    } catch (err) {
      throw new NotFoundException(`Route with ID ${id} not found`);
    }
  }

  async findNearby(
    lng: number,
    lat: number,
    radiusMeters: number = 5000,
  ): Promise<any[]> {
    this.logger.log(
      `Finding routes near [${lng}, ${lat}] within ${radiusMeters}m`,
    );
    const deltaLat = radiusMeters / 111111;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const deltaLng = radiusMeters / (111111 * Math.abs(cosLat) || 1);

    const minLat = lat - deltaLat;
    const maxLat = lat + deltaLat;
    const minLng = lng - deltaLng;
    const maxLng = lng + deltaLng;

    const routes = await this.prisma.route.findMany();
    return routes
      .filter((route: any) => {
        if (!route.path || !route.path.coordinates) return false;
        return route.path.coordinates.some(([rLng, rLat]: [number, number]) => {
          // Bounding Box filter check first (extremely fast O(1) float comparison)
          if (rLat < minLat || rLat > maxLat || rLng < minLng || rLng > maxLng) {
            return false;
          }
          // Only compute full Haversine if inside bounding box
          return getDistance(lng, lat, rLng, rLat) <= radiusMeters;
        });
      })
      .map((r) => ({ ...r, _id: r.id }));
  }

  async findNearestCheckpoint(
    id: string,
    lng: number,
    lat: number,
  ): Promise<any> {
    const route = await this.findById(id);
    if (
      !route ||
      !route.checkpoints ||
      (route.checkpoints as any[]).length === 0
    ) {
      return null;
    }

    let closest: any = null;
    let minDistance = Infinity;

    for (const checkpoint of route.checkpoints as any[]) {
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

  async smartSearch(
    pickupLng: number,
    pickupLat: number,
    dropoffLng: number,
    dropoffLat: number,
    radiusMeters: number = 5000,
  ): Promise<any[]> {
    this.logger.log(
      `Smart search: pickup=[${pickupLat},${pickupLng}] dropoff=[${dropoffLat},${dropoffLng}] radius=${radiusMeters}m`,
    );

    const routes = await this.prisma.route.findMany();
    const results: any[] = [];

    for (const route of routes) {
      const checkpoints = route.checkpoints as any[];
      if (!checkpoints || checkpoints.length < 2) continue;

      let pickupCp: any = null;
      let pickupDistance = Infinity;
      let pickupIdx = -1;

      let dropoffCp: any = null;
      let dropoffDistance = Infinity;
      let dropoffIdx = -1;

      // Single-pass execution to find nearest pickup and dropoff checkpoints
      for (let i = 0; i < checkpoints.length; i++) {
        const cp = checkpoints[i];
        if (!cp.location?.coordinates) continue;
        const [cpLng, cpLat] = cp.location.coordinates;

        const distToPickup = getDistance(pickupLng, pickupLat, cpLng, cpLat);
        const distToDropoff = getDistance(dropoffLng, dropoffLat, cpLng, cpLat);

        if (distToPickup < pickupDistance) {
          pickupDistance = distToPickup;
          pickupCp = cp;
          pickupIdx = i;
        }

        if (distToDropoff < dropoffDistance) {
          dropoffDistance = distToDropoff;
          dropoffCp = cp;
          dropoffIdx = i;
        }
      }

      // Both checkpoints must be within radius
      if (pickupDistance > radiusMeters || dropoffDistance > radiusMeters)
        continue;

      // Pickup must come BEFORE dropoff in the route sequence (correct travel direction)
      if (pickupIdx >= dropoffIdx) continue;

      results.push({
        route: { ...route, _id: route.id },
        pickupCheckpoint: {
          ...pickupCp,
          distanceMeters: Math.round(pickupDistance),
          index: pickupIdx,
        },
        dropoffCheckpoint: {
          ...dropoffCp,
          distanceMeters: Math.round(dropoffDistance),
          index: dropoffIdx,
        },
        totalWalkingDistance: Math.round(pickupDistance + dropoffDistance),
      });
    }

    // Sort by total walking distance (closest combined pickup+dropoff first)
    results.sort((a, b) => a.totalWalkingDistance - b.totalWalkingDistance);

    return results;
  }

  async findNearestCheckpoints(
    lng: number,
    lat: number,
    limit: number = 5,
  ): Promise<any[]> {
    this.logger.log(`Finding nearest checkpoints to [${lng}, ${lat}]`);
    const routes = await this.prisma.route.findMany();
    const candidates: any[] = [];

    for (const route of routes) {
      const checkpoints = (route.checkpoints as any[]) || [];
      for (const cp of checkpoints) {
        if (!cp.location?.coordinates) continue;
        const [cpLng, cpLat] = cp.location.coordinates;
        const distance = getDistance(lng, lat, cpLng, cpLat);

        candidates.push({
          checkpoint: cp,
          route: {
            id: route.id,
            _id: route.id,
            name: route.name,
          },
          distanceMeters: Math.round(distance),
        });
      }
    }

    // Sort by distance ascending
    candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);

    return candidates.slice(0, limit);
  }
}
