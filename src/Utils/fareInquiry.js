// When the booking sheet asks for a fare (the fare inquiry, INQUIRE_BOOKING)
// and which fare it may use. Pure (no RN imports) so it runs under
// `node --test`.
//
// docs/booking-redesign-spec.md ("Service list"): the inquiry fires as soon as
// pickup, drop-off and a ride are all set, and again, debounced, whenever one
// of them changes; not on the Book press. A fare belongs to the exact trip it
// was asked for: the ride, both points, the promo and the pickup time. Booking
// sends that fare's own figures (triggerCreateBooking), so a fare asked for
// any other trip is dropped, never shown and never booked.

// How long the trip must stay unchanged before it is priced, so tapping
// through the rides asks once, for the last one.
const FARE_DEBOUNCE_MS = 400;

const point = place => {
  const lat = Number(place?.lat);
  const long = Number(place?.long);
  if (place?.lat == null || place?.long == null) {
    return null;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(long)) {
    return null;
  }
  return `${lat.toFixed(6)},${long.toFixed(6)}`;
};

const when = scheduledAt => {
  if (!scheduledAt) {
    return 'now';
  }
  const t = new Date(scheduledAt);
  return Number.isNaN(t.getTime()) ? 'now' : t.toISOString();
};

// The trip a fare is for, as one string; null while the trip is incomplete.
function fareKey({ pickup, dropoff, serviceId, promoId, scheduledAt }) {
  const from = point(pickup);
  const to = point(dropoff);
  if (!from || !to || serviceId == null || serviceId === '') {
    return null;
  }
  return [String(serviceId), from, to, promoId ?? '', when(scheduledAt)].join(
    '|',
  );
}

// Whether to ask for a fare now: the trip is complete, nothing holds the
// sheet (a placed booking, the pickup panel, no connection or location), no
// inquiry is on its way, and this trip has neither a fare nor a refusal yet.
function shouldPrice({ key, held, loading, pricedKey, failedKey }) {
  return (
    Boolean(key) && !held && !loading && key !== pricedKey && key !== failedKey
  );
}

module.exports = { FARE_DEBOUNCE_MS, fareKey, shouldPrice };
