// Small geo helpers for the live-tracking map (heading, distance, look-ahead point).
// CommonJS so the node tests can require it directly.

const R = 6371000; // Earth radius, meters
const toRad = d => (d * Math.PI) / 180;
const toDeg = r => (r * 180) / Math.PI;

/** Distance between two {latitude, longitude} points, in meters. */
function distanceMeters(a, b) {
  if (!a || !b) {
    return 0;
  }
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass bearing from a to b, 0-360 degrees (0 = north). */
function bearingDegrees(a, b) {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** The point `meters` ahead of `from` along `bearing` (used to keep the car low on screen). */
function pointAhead(from, bearing, meters) {
  const d = meters / R;
  const b = toRad(bearing);
  const lat1 = toRad(from.latitude);
  const lng1 = toRad(from.longitude);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: toDeg(lat2), longitude: toDeg(lng2) };
}

/**
 * Next heading for the vehicle marker/camera. Uses the GPS heading when the
 * vehicle is really moving, else the bearing of the last movement, and keeps
 * the previous heading while stopped (GPS jitter must not spin the car).
 */
function nextHeading({
  previous,
  from,
  to,
  gpsHeading,
  speed,
  minMoveMeters = 4,
}) {
  if (gpsHeading != null && gpsHeading >= 0 && speed != null && speed > 1.5) {
    return gpsHeading % 360;
  }
  if (from && to && distanceMeters(from, to) >= minMoveMeters) {
    return bearingDegrees(from, to);
  }
  return previous ?? 0;
}

/** Camera zoom for navigation: closer when slow, wider when fast. */
function navZoom(speedMps) {
  const kmh = (speedMps || 0) * 3.6;
  if (kmh > 60) {
    return 16;
  }
  if (kmh > 30) {
    return 16.8;
  }
  return 17.5;
}

module.exports = {
  distanceMeters,
  bearingDegrees,
  pointAhead,
  nextHeading,
  navZoom,
};
