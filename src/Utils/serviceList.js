// What each row of the ride list in the booking sheet shows (ServiceList.js).
// Pure (no RN imports) so it runs under `node --test`.
//
// The fare comes from the fare inquiry (INQUIRE_BOOKING), which prices one
// ride type at a time. So only the chosen ride shows a fare, with the trip
// time in front of its meta line, and only when the inquiry was for that ride
// (`booking_type`): a fare left over from another ride is never shown on this
// one. Every other row shows a dash (docs/booking-redesign-spec.md, "Service
// list", option 3).

const NO_FARE = '—';

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

// The inquiry's fare and trip time for this ride, or null when it was not priced.
function pricedFor(service, fare) {
  if (!fare || !sameId(fare.booking_type, service.id)) {
    return null;
  }
  if (!fare.pretty_total_amount) {
    return null;
  }
  return {
    amount: fare.pretty_total_amount,
    tripTime: fare.pretty_eta_pickup_to_dropoff || '',
  };
}

// One row per ride: { service, selected, meta, fare, label }. `label` is what
// a screen reader says. `selectedOnly` keeps just the chosen ride, for a
// booking that is already placed.
function serviceRows({
  services = [],
  selectedId,
  fare,
  selectedOnly = false,
}) {
  return services
    .map(service => {
      const selected = sameId(service.id, selectedId);
      const priced = selected ? pricedFor(service, fare) : null;
      const meta = [priced && priced.tripTime, service.meta]
        .filter(Boolean)
        .join(' · ');
      return {
        service,
        selected,
        meta,
        fare: priced ? priced.amount : NO_FARE,
        label: [
          service.title,
          service.badge && service.badge.toLowerCase(),
          meta,
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
  serviceRows,
};
