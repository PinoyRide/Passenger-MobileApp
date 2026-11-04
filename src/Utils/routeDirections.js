// Turns a Google Directions response into a road-following line and decides
// when the live route should be re-fetched. Pure (no RN imports) so it runs
// under `node --test`.
const REFETCH_INTERVAL_MS = 15000;
const REFETCH_DISTANCE_M = 50;

function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (encoded && index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

const samePoint = (a, b) =>
  a && b && a.latitude === b.latitude && a.longitude === b.longitude;

// Builds the line from every step's detailed polyline. Google's
// overview_polyline drops points, which makes short trips cut across blocks.
function routeFromDirections(data) {
  const route = data && data.status === 'OK' && data.routes && data.routes[0];
  if (!route) {
    return { ok: false, coords: [], leg: null };
  }
  const leg = (route.legs && route.legs[0]) || null;
  const coords = [];
  ((leg && leg.steps) || []).forEach(step => {
    decodePolyline(step.polyline && step.polyline.points).forEach(pt => {
      if (!samePoint(coords[coords.length - 1], pt)) {
        coords.push(pt);
      }
    });
  });
  if (coords.length < 2 && route.overview_polyline) {
    return {
      ok: true,
      coords: decodePolyline(route.overview_polyline.points),
      leg,
    };
  }
  return { ok: coords.length > 1, coords, leg };
}

function distanceMeters(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// Re-fetch while the rider moves: every 15s, or sooner after 50m of travel.
function shouldRefetchRoute({ lastAt, lastPos, now, pos }) {
  if (!pos) {
    return false;
  }
  if (!lastPos) {
    return true;
  }
  return (
    now - lastAt >= REFETCH_INTERVAL_MS ||
    distanceMeters(lastPos, pos) >= REFETCH_DISTANCE_M
  );
}

module.exports = {
  REFETCH_INTERVAL_MS,
  decodePolyline,
  routeFromDirections,
  shouldRefetchRoute,
};
