/**
 * Calculate the distance between two geographic points using the Haversine formula.
 * @param lng1 Longitude of point 1
 * @param lat1 Latitude of point 1
 * @param lng2 Longitude of point 2
 * @param lat2 Latitude of point 2
 * @returns Distance in metres
 */
export function getDistance(
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

/**
 * Snaps a given longitude and latitude coordinate to the closest point along a route path.
 * @param longitude Input longitude
 * @param latitude Input latitude
 * @param coordinates Array of route path coordinates [[lng, lat], ...]
 */
export function snapToRoute(
  longitude: number,
  latitude: number,
  coordinates: [number, number][],
): { longitude: number; latitude: number } {
  if (!coordinates || coordinates.length === 0) {
    return { longitude, latitude };
  }
  if (coordinates.length === 1) {
    return { longitude: coordinates[0][0], latitude: coordinates[0][1] };
  }

  let minDistanceSq = Infinity;
  let closestPoint = { longitude, latitude };

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [x1, y1] = coordinates[i];
    const [x2, y2] = coordinates[i + 1];

    const dx = x2 - x1;
    const dy = y2 - y1;

    if (dx === 0 && dy === 0) {
      const distSq = (longitude - x1) ** 2 + (latitude - y1) ** 2;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestPoint = { longitude: x1, latitude: y1 };
      }
      continue;
    }

    let t =
      ((longitude - x1) * dx + (latitude - y1) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));

    const snapLng = x1 + t * dx;
    const snapLat = y1 + t * dy;

    const distSq = (longitude - snapLng) ** 2 + (latitude - snapLat) ** 2;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closestPoint = { longitude: snapLng, latitude: snapLat };
    }
  }

  return closestPoint;
}
