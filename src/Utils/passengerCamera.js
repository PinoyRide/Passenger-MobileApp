// Passenger live-tracking camera rules. Pure (no RN imports) so it runs
// under `node --test`.
// ~150 m: the closest the auto-zoom gets, so a nearby rider is zoomed right in.
const MIN_SPAN_DEG = 0.0013;
// After the passenger pans or pinches, leave the camera alone this long.
const USER_PAUSE_MS = 10000;

// Points to fit so the rider and the passenger's pin are both visible. When
// they're close, two padding corners keep a minimum span around them.
function framePoints(rider, target) {
  if (!rider || !target) {
    return null;
  }
  const latSpan = Math.abs(rider.latitude - target.latitude);
  const lngSpan = Math.abs(rider.longitude - target.longitude);
  if (latSpan >= MIN_SPAN_DEG && lngSpan >= MIN_SPAN_DEG) {
    return [rider, target];
  }
  const midLat = (rider.latitude + target.latitude) / 2;
  const midLng = (rider.longitude + target.longitude) / 2;
  const halfLat = Math.max(latSpan, MIN_SPAN_DEG) / 2;
  const halfLng = Math.max(lngSpan, MIN_SPAN_DEG) / 2;
  return [
    rider,
    target,
    { latitude: midLat - halfLat, longitude: midLng - halfLng },
    { latitude: midLat + halfLat, longitude: midLng + halfLng },
  ];
}

function isUserControlling(lastTouchAt, now) {
  return Boolean(lastTouchAt) && now - lastTouchAt < USER_PAUSE_MS;
}

module.exports = {
  MIN_SPAN_DEG,
  USER_PAUSE_MS,
  framePoints,
  isUserControlling,
};
