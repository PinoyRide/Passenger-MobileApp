// The widening search (the owner, 2026-11-22), as the backend's SearchReach:
// an instant booking nobody accepts is offered within 1.5 km for its first 5
// minutes, 3 km for the next 10 and 5 km for the next 10, and at 25 minutes
// the app says no rider was found; Try again starts over. The booking carries
// its own steps (search_steps, search_ends_after_minutes); these defaults are
// the same, for a booking that does not.
const MINUTE = 60000;
const DEFAULT_STEPS = [
  { afterMinutes: 0, km: 1.5 },
  { afterMinutes: 5, km: 3 },
  { afterMinutes: 15, km: 5 },
];
const DEFAULT_ENDS_MINUTES = 25;

// The booking's steps, in order of minute, starting at minute 0.
const stepsOf = booking => {
  const raw = Array.isArray(booking?.search_steps) ? booking.search_steps : [];
  const steps = raw
    .map(s => ({ afterMinutes: Number(s?.after_minutes), km: Number(s?.km) }))
    .filter(
      s =>
        Number.isFinite(s.afterMinutes) &&
        s.afterMinutes >= 0 &&
        Number.isFinite(s.km) &&
        s.km > 0,
    )
    .sort((a, b) => a.afterMinutes - b.afterMinutes);
  return steps.length > 0 && steps[0].afterMinutes === 0
    ? steps
    : DEFAULT_STEPS;
};

// When "No riders available" shows, in ms after the search began.
const searchEndsMs = booking => {
  const minutes = Number(booking?.search_ends_after_minutes);
  return (
    (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_ENDS_MINUTES) *
    MINUTE
  );
};

// The reach `ageMs` after the search began, in km.
const reachKmAt = (steps, ageMs) => {
  let km = steps[0].km;
  for (const step of steps) {
    if (ageMs >= step.afterMinutes * MINUTE) {
      km = step.km;
    }
  }
  return km;
};

// How long until the next widening, in ms, or null when there is none left.
const nextWideningIn = (steps, ageMs) => {
  const next = steps.find(step => step.afterMinutes * MINUTE > ageMs);
  return next ? next.afterMinutes * MINUTE - ageMs : null;
};

module.exports = {
  DEFAULT_STEPS,
  DEFAULT_ENDS_MINUTES,
  stepsOf,
  searchEndsMs,
  reachKmAt,
  nextWideningIn,
};
