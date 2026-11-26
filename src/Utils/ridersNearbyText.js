// The "Riders nearby" button's words for what it shows (Hooks/useNearbyRiders.js).
// How far it looks comes with the backend's answer (`reachKm`, the backend's
// NearbyRiders.ReachKm: 4 km since the owner asked on 2026-11-22), so the app
// keeps no figure of its own; an answer without one says "nearby".
const reachText = reachKm => {
  const km = Number(reachKm);
  return reachKm != null && Number.isFinite(km) && km > 0
    ? `within ${km} km`
    : 'nearby';
};

const ridersNearbyText = nearby => {
  if (nearby?.unknown) {
    return 'Your location is not known yet';
  }
  if (nearby?.failed) {
    return 'Couldn’t load riders';
  }
  if (nearby?.looking) {
    return 'Looking for riders…';
  }
  if (nearby?.riders) {
    const where = reachText(nearby.reachKm);
    if (nearby.count === 0) {
      return `No riders ${where}`;
    }
    return `${nearby.count} ${
      nearby.count === 1 ? 'rider' : 'riders'
    } ${where}`;
  }
  return 'Riders nearby';
};

module.exports = { ridersNearbyText };
