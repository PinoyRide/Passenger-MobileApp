// The passenger's recent places (the owner, 2026-11-23: "can we have a
// recent drop-off and pick up here so the passenger wont be searching
// again"): the drop-offs and pick-ups of their latest trips, newest first,
// each place once, none that is already a saved place (Home, Work...).
// Choosing one costs no Google lookup. Pure (no RN imports) so it runs
// under `node --test`.

const { distanceKm } = require('./tripText');

// Two places this close (or with the same address) are one place.
const SAME_PLACE_KM = 0.075;
// How many are kept; the Where to? sheet shows the first 3, the place
// picker the first 5.
const MAX_KEPT = 8;

function placeOf(address, lat, long) {
  const text = String(address || '')
    .replace(/\s+/g, ' ')
    .trim();
  const la = Number(lat);
  const lo = Number(long);
  if (
    !text ||
    lat == null ||
    long == null ||
    !Number.isFinite(la) ||
    !Number.isFinite(lo) ||
    (la === 0 && lo === 0)
  ) {
    return null;
  }
  return { address: text, lat: la, long: lo };
}

function samePlace(a, b) {
  if (a.address.toLowerCase() === b.address.toLowerCase()) {
    return true;
  }
  const km = distanceKm(a, b);
  return km != null && km <= SAME_PLACE_KM;
}

// Each place once, in order, leaving out the saved ones.
function mergePlaces(places, saved, limit = MAX_KEPT) {
  const savedPoints = (Array.isArray(saved) ? saved : [])
    .map(p => placeOf(p?.address, p?.lat, p?.long))
    .filter(Boolean);
  const out = [];
  for (const place of places) {
    if (
      place &&
      !savedPoints.some(s => samePlace(s, place)) &&
      !out.some(o => samePlace(o, place))
    ) {
      out.push(place);
      if (out.length >= limit) {
        break;
      }
    }
  }
  return out;
}

const timeOf = booking => {
  const at = Date.parse(booking?.created_at || booking?.booking_date || '');
  return Number.isFinite(at) ? at : 0;
};

// A booking's places as the list keeps them: its drop-off, then its pick-up.
function placesOfBooking(booking) {
  return [
    placeOf(
      booking?.dropoff_location,
      booking?.dropoff_lat,
      booking?.dropoff_long,
    ),
    placeOf(
      booking?.pickup_location,
      booking?.pickup_lat,
      booking?.pickup_long,
    ),
  ];
}

// From booking/get_history's bookings: newest trip first.
function recentPlacesFrom(bookings, saved, limit) {
  const list = (Array.isArray(bookings) ? bookings : [])
    .map((booking, index) => ({ booking, index }))
    .sort((a, b) => timeOf(b.booking) - timeOf(a.booking) || a.index - b.index)
    .map(x => x.booking);
  return mergePlaces(list.flatMap(placesOfBooking), saved, limit);
}

// A trip just booked goes in front of the list.
function withBooking(recent, booking, saved, limit) {
  return mergePlaces(
    [...placesOfBooking(booking), ...(Array.isArray(recent) ? recent : [])],
    saved,
    limit,
  );
}

// What a row shows: the place's name, then the rest of its address.
function titleOf(place) {
  const text = String(place?.address || '');
  return text.split(/[\n,]/)[0].trim() || text;
}

function subtitleOf(place) {
  const text = String(place?.address || '');
  const title = titleOf(place);
  return text.startsWith(title)
    ? text
        .slice(title.length)
        .replace(/^[\s,]+/, '')
        .replace(/\n/g, ', ')
    : '';
}

module.exports = {
  MAX_KEPT,
  recentPlacesFrom,
  withBooking,
  titleOf,
  subtitleOf,
};
