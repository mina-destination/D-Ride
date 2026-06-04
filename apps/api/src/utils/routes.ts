import { getDistance } from './geo';

export function getVirtualRoute(
  parentRoute: any,
  startIndex: number,
  endIndex: number,
) {
  const checkpoints = (parentRoute.checkpoints as any[]) || [];
  const startCp = checkpoints[startIndex];
  const endCp = checkpoints[endIndex];

  if (!startCp || !endCp) {
    return { ...parentRoute };
  }

  if (
    startCp.purpose === 'REST' ||
    startCp.purpose === 'DROP_OFF' ||
    endCp.purpose === 'REST' ||
    endCp.purpose === 'PICKUP'
  ) {
    throw new Error(
      'Invalid virtual route: checkpoints do not support pickup/dropoff roles',
    );
  }

  const id = `${parentRoute.id}_sub_${startIndex}_${endIndex}`;

  // Construct English and Arabic names
  const name = `${startCp.name} to ${endCp.name}`;
  const nameAr = `${startCp.nameAr || startCp.name} إلى ${endCp.nameAr || endCp.name}`;

  const startMinutes = startCp.minutesFromStart || 0;
  const startPrice = startCp.priceFromStartEGP || 0;

  // Construct relative checkpoints
  const subCheckpoints = checkpoints
    .slice(startIndex, endIndex + 1)
    .map((cp, idx) => {
      const relativeMinutes = Math.max(
        0,
        (cp.minutesFromStart || 0) - startMinutes,
      );
      const relativePrice = Math.max(
        0,
        (cp.priceFromStartEGP || 0) - startPrice,
      );

      let type = 'CHECKPOINT';
      if (idx === 0) type = 'START';
      else if (idx === endIndex - startIndex) type = 'END';

      return {
        ...cp,
        type,
        order: idx + 1,
        minutesFromStart: relativeMinutes,
        priceFromStartEGP: relativePrice,
      };
    });

  const duration = Math.max(1, (endCp.minutesFromStart || 0) - startMinutes);

  // Slice geographic coordinates
  let slicedPath = parentRoute.path;
  if (parentRoute.path && parentRoute.path.coordinates) {
    const coords = parentRoute.path.coordinates;
    const findClosestIdx = (cp: any) => {
      if (!cp.location || !cp.location.coordinates) return -1;
      const [cpLng, cpLat] = cp.location.coordinates;
      let minD = Infinity;
      let closestIdx = -1;
      for (let k = 0; k < coords.length; k++) {
        const [rLng, rLat] = coords[k];
        const d = Math.pow(rLng - cpLng, 2) + Math.pow(rLat - cpLat, 2);
        if (d < minD) {
          minD = d;
          closestIdx = k;
        }
      }
      return closestIdx;
    };

    const cStartIdx = findClosestIdx(startCp);
    const cEndIdx = findClosestIdx(endCp);
    if (cStartIdx !== -1 && cEndIdx !== -1 && cStartIdx < cEndIdx) {
      slicedPath = {
        ...parentRoute.path,
        coordinates: coords.slice(cStartIdx, cEndIdx + 1),
      };
    }
  }

  // Calculate distance
  let distanceKm = 0;
  if (startCp.location?.coordinates && endCp.location?.coordinates) {
    const [lng1, lat1] = startCp.location.coordinates;
    const [lng2, lat2] = endCp.location.coordinates;
    distanceKm =
      Math.round((getDistance(lng1, lat1, lng2, lat2) / 1000) * 1.25 * 10) / 10;
  }
  if (!distanceKm || isNaN(distanceKm)) {
    distanceKm =
      parentRoute.distanceKm *
      (duration / (parentRoute.estimatedDurationMinutes || 1));
    distanceKm = Math.round(distanceKm * 10) / 10;
  }

  return {
    ...parentRoute,
    id,
    _id: id,
    name,
    nameAr,
    checkpoints: subCheckpoints,
    distanceKm,
    estimatedDurationMinutes: duration,
    path: slicedPath,
    isVirtual: true,
    parentRouteId: parentRoute.id,
  };
}
