// Passenger live-tracking camera rules. Pure (no RN imports) so it runs
// under `node --test`.
const { distanceMeters, pointAhead } = require('./navMath');

// Follow view (the default in transit): the camera is behind the vehicle and
// faces the way it is going, so the passenger sees the trip moving forward,
// up the screen. The camera does not glide along with the vehicle: it holds
// still while the vehicle drives up the screen, and steps forward when the
// vehicle has gone far enough or has turned. (A camera that moves on every
// frame makes the whole map redraw on every frame. On slower phones that
// starves the rest of the app, and the vehicle's position goes stale.)
const FOLLOW_PITCH = 45;
const FOLLOW_ZOOM = 17;
// After a camera step the vehicle sits this far below the centre of the map...
const FOLLOW_BEHIND_METERS = 70;
// ...and may drive this far before the camera steps again.
const FOLLOW_TRAVEL_METERS = 90;
// A turn of this much steps the camera at once, to face the new road.
const FOLLOW_TURN_DEGREES = 25;
// Overview: re-frame once the rider has moved this far.
const REFRAME_METERS = 1;
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

// In transit the passenger is on the vehicle, so the map follows it and they
// see the trip going forward. While the rider is still on the way, the map
// shows the rider and the pickup pin together instead.
function followsByDefault(bookingStatus) {
  return Number(bookingStatus) === 2;
}

// Camera for the follow view: looking past the vehicle along its heading.
function followCamera(rider, heading) {
  const direction = Number(heading) || 0;
  return {
    center: pointAhead(rider, direction, FOLLOW_BEHIND_METERS),
    heading: direction,
    pitch: FOLLOW_PITCH,
    zoom: FOLLOW_ZOOM,
  };
}

// Whether the follow camera should step now. `last` is what it was aimed at
// the last time it moved: { rider, heading }, or null if it has not moved yet.
function needsFollowStep(last, rider, heading) {
  if (!last) {
    return true;
  }
  const turned =
    Math.abs((((Number(heading) || 0) - last.heading + 540) % 360) - 180) >=
    FOLLOW_TURN_DEGREES;
  return turned || distanceMeters(last.rider, rider) >= FOLLOW_TRAVEL_METERS;
}

// Whether the overview has anything new to frame (the rider has moved).
function needsReframe(lastRider, rider) {
  return !lastRider || distanceMeters(lastRider, rider) >= REFRAME_METERS;
}

function isUserControlling(lastTouchAt, now) {
  return Boolean(lastTouchAt) && now - lastTouchAt < USER_PAUSE_MS;
}

module.exports = {
  MIN_SPAN_DEG,
  USER_PAUSE_MS,
  FOLLOW_BEHIND_METERS,
  FOLLOW_TRAVEL_METERS,
  FOLLOW_TURN_DEGREES,
  framePoints,
  followsByDefault,
  followCamera,
  needsFollowStep,
  needsReframe,
  isUserControlling,
};
