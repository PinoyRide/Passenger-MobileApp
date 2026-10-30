// Trims a route polyline so it starts at the rider's live position, the way
// Grab/Angkas shrink the line as the rider drives. Pure function, no API calls.

const EARTH_RADIUS_M = 6371000;

export const distanceMeters = (a, b) => {
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

// Returns { coords, offRouteMeters }. coords begins at the rider and follows
// the remaining route; offRouteMeters is the rider's distance to the nearest
// route point (used to decide when to re-fetch directions).
export const trimRouteToRider = (route, rider) => {
  if (!rider || !Array.isArray(route) || route.length === 0) {
    return { coords: route || [], offRouteMeters: 0 };
  }
  let nearest = 0;
  let best = Infinity;
  route.forEach((pt, i) => {
    const d = distanceMeters(rider, pt);
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  return { coords: [rider, ...route.slice(nearest + 1)], offRouteMeters: best };
};
