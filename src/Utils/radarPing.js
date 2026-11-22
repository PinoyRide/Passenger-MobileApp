// The radar ping while a rider is being found (the owner, 2026-11-22: "make a
// radar ping 1.5 km for me", on "Finding your rider"): rings sweep out from
// the pickup to the reach of a new booking, one after another, each fading as
// it grows (Components/AppMap/AppMap.js draws them).

// How far a new booking is offered to riders: the backend's
// BookingRules.RiderRadiusKm, 1.5 km. Change the two together.
const REACH_M = 1500;
// One ring's sweep, and how many rings are out at once (evenly spaced).
const SWEEP_MS = 2400;
const RINGS = 2;

// Each ring `elapsedMs` after the ping began: its radius as a share of the
// reach (quick at first, slowing toward the edge) and its opacity (fading).
const ringsAt = elapsedMs => {
  const rings = [];
  for (let i = 0; i < RINGS; i++) {
    const p = (((elapsedMs / SWEEP_MS + i / RINGS) % 1) + 1) % 1;
    rings.push({ share: 1 - (1 - p) * (1 - p), alpha: 1 - p });
  }
  return rings;
};

// Two corners of the square that holds a circle of `radiusM` around a point,
// for bringing the whole circle into view.
const boundsAround = (lat, long, radiusM) => {
  const dLat = radiusM / 111320;
  const dLong = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [
    { latitude: lat + dLat, longitude: long - dLong },
    { latitude: lat - dLat, longitude: long + dLong },
  ];
};

module.exports = { REACH_M, SWEEP_MS, ringsAt, boundsAround };
