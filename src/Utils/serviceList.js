// What each row of the ride list in the booking sheet shows (ServiceList.js).
// Pure (no RN imports) so it runs under `node --test`.
//
// The fare comes from the fare inquiry (INQUIRE_BOOKING), which prices one
// ride type at a time, as soon as the trip is complete (Utils/fareInquiry.js).
// So only the chosen ride shows a fare, with the trip time in front of its
// meta line, and only when the inquiry was for that ride (`booking_type`): a
// fare left over from another ride is never shown on this one. Every other
// row shows a dash (docs/booking-redesign-spec.md, "Service list", option 3).
const { formatPeso } = require('./formatPeso');
const { tripLengthText } = require('./tripText');

const NO_FARE = '—';
// A ride not offered yet (`soon`; the owner, 2026-11-23: "make the car 4
// seats and 6 seats coming soon") is listed but cannot be chosen: never
// selected, no fare, this under its name. A booking placed for it before
// still shows it as booked.
const COMING_SOON = 'Coming soon';

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

// The trip's length, worded as a trip so it does not read as the wait for a
// rider: "28 min trip", "1 hr 15 min trip". '' when unknown.
function tripTimeText(minutes) {
  const length = tripLengthText(minutes);
  return length ? `${length} trip` : '';
}

// The inquiry's fare and trip time for this ride, or null when it was not priced.
function pricedFor(service, fare) {
  if (!fare || !sameId(fare.booking_type, service.id)) {
    return null;
  }
  if (fare.total_amount == null || fare.total_amount === '') {
    return null;
  }
  if (!Number.isFinite(Number(fare.total_amount))) {
    return null;
  }
  return {
    amount: formatPeso(fare.total_amount),
    tripTime: tripTimeText(fare.eta_pickup_to_dropoff_minutes),
  };
}

// One row per ride: { service, selected, soon, meta, fare, label }. `label`
// is what a screen reader says; `fare` is '' on a ride coming soon.
// `selectedOnly` keeps just the chosen ride, for a booking that is already
// placed.
function serviceRows({
  services = [],
  selectedId,
  fare,
  selectedOnly = false,
}) {
  return services
    .map(service => {
      const soon = Boolean(service.soon) && !selectedOnly;
      const selected = !soon && sameId(service.id, selectedId);
      const priced = selected ? pricedFor(service, fare) : null;
      const meta = soon
        ? COMING_SOON
        : [priced && priced.tripTime, service.meta].filter(Boolean).join(' · ');
      return {
        service,
        selected,
        soon,
        meta,
        fare: soon ? '' : priced ? priced.amount : NO_FARE,
        label: [
          service.title,
          service.badge && service.badge.toLowerCase(),
          soon ? COMING_SOON.toLowerCase() : meta,
          priced && priced.amount,
        ]
          .filter(Boolean)
          .join(', '),
      };
    })
    .filter(row => !selectedOnly || row.selected);
}

module.exports = {
  NO_FARE,
  COMING_SOON,
  serviceRows,
  tripTimeText,
};
