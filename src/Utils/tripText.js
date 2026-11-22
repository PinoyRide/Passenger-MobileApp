// A trip's length, distance and fare notes, in words, for the booking
// sheet and the chip on the map. Pure (no RN imports) so it runs under
// `node --test`. Every figure comes from the fare inquiry's answer.

// "28 min", "1 hr", "1 hr 15 min"; '' when unknown.
function tripLengthText(minutes) {
  const m = Math.round(Number(minutes));
  if (!Number.isFinite(m) || m <= 0) {
    return '';
  }
  if (m < 60) {
    return `${m} min`;
  }
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

// "5.4 km" under 10 km, "12 km" above; '' when unknown.
function distanceText(km) {
  const n = Number(km);
  if (km == null || km === '' || !Number.isFinite(n) || n <= 0) {
    return '';
  }
  return n < 10 ? `${n.toFixed(1)} km` : `${Math.round(n)} km`;
}

// The chip on the map once the trip is priced: "28 min · 5.4 km".
function tripChipText({ minutes, km }) {
  return [tripLengthText(minutes), distanceText(km)]
    .filter(Boolean)
    .join(' · ');
}

// The fare's own notes, said only when the answer shows them: a booking fee
// in the total, and no traffic surcharge ("Incl. booking fee · no surge").
function fareNoteText(fare) {
  const notes = [
    Number(fare?.booking_fee) > 0 && 'Incl. booking fee',
    fare?.traffic_surcharge_amount != null &&
      fare.traffic_surcharge_amount !== '' &&
      Number(fare.traffic_surcharge_amount) === 0 &&
      'no surge',
  ].filter(Boolean);
  const text = notes.join(' · ');
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

module.exports = { tripLengthText, distanceText, tripChipText, fareNoteText };
