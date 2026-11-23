// A closed road Google does not know of (the owner, 2026-11-23: "when the road is close it should
// automatically find a better way"). When the rider leaves the drawn line, the road they left may be
// closed, and Google's fastest way from where they are now can go straight back through it: in Makati,
// three reroutes in a row (60, 150 and 300 m into the detour) sent the rider back onto the stretch they
// had turned away from, while a way around it two minutes slower was on offer each time.
//
// So the stretch the rider left (the next 400 m of the line) is remembered for the rest of the leg.
// While any is remembered, Directions is asked for alternatives (the same request, at the same price) and
// the fastest route that keeps off every remembered stretch is drawn; the fastest of all only when none
// does. A stretch the rider is later seen on was open after all, and is forgotten.
//
// The same file in both apps (sharedUi.test.mjs): the rider's and the passenger's maps choose alike.

const LEFT_STRETCH_M = 400; // how much of the road ahead counts as left
const JUNCTION_M = 30; // not the junction itself: a new route may cross it
const SAMPLE_M = 20; // the stretch is checked every 20 m
const NEAR_M = 20; // a route this near a sample is on that piece of road
const ALONG_SAMPLES = 3; // three samples in a row (40 m): the route takes that road, not just crosses it
const MAX_STRETCHES = 5;

function metres(a, b) {
  const rad = d => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// Metres from `p` to the segment a-b (flat: fine within a city).
function toSegment(p, a, b) {
  const kx = Math.cos((p.latitude * Math.PI) / 180) * 111320;
  const ky = 110540;
  const ax = a.longitude * kx;
  const ay = a.latitude * ky;
  const dx = b.longitude * kx - ax;
  const dy = b.latitude * ky - ay;
  const px = p.longitude * kx - ax;
  const py = p.latitude * ky - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
  return Math.hypot(px - t * dx, py - t * dy);
}

function fromLine(p, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    best = Math.min(best, toSegment(p, line[i], line[i + 1]));
  }
  return best;
}

// The road the rider left. `ahead` is the line onward from where the rider was last on it; the stretch is
// a point every SAMPLE_M from JUNCTION_M to JUNCTION_M + LEFT_STRETCH_M along it (less where the line ends
// sooner), or [] when too little of it lies past the junction.
function stretchLeft(ahead) {
  if (!Array.isArray(ahead) || ahead.length < 2) {
    return [];
  }
  const samples = [];
  const end = JUNCTION_M + LEFT_STRETCH_M;
  let walked = 0;
  let next = JUNCTION_M;
  for (let i = 0; i < ahead.length - 1 && next <= end; i++) {
    const a = ahead[i];
    const b = ahead[i + 1];
    const length = metres(a, b);
    while (next <= walked + length && next <= end) {
      const t = length ? (next - walked) / length : 0;
      samples.push({
        latitude: a.latitude + t * (b.latitude - a.latitude),
        longitude: a.longitude + t * (b.longitude - a.longitude),
      });
      next += SAMPLE_M;
    }
    walked += length;
  }
  return samples.length >= ALONG_SAMPLES ? samples : [];
}

// Whether `route` runs along `stretch` (ALONG_SAMPLES points of it in a row), not merely across it.
function takesStretch(route, stretch) {
  let run = 0;
  for (const point of stretch) {
    run = fromLine(point, route) <= NEAR_M ? run + 1 : 0;
    if (run >= ALONG_SAMPLES) {
      return true;
    }
  }
  return false;
}

// Which of Google's routes (fastest first) to draw: the first that takes none of the stretches, or the
// first of all when every one takes one.
function routeAvoiding(routes, stretches) {
  if (!Array.isArray(routes) || !stretches || stretches.length === 0) {
    return 0;
  }
  const index = routes.findIndex(
    route =>
      Array.isArray(route) &&
      route.length > 1 &&
      !stretches.some(stretch => takesStretch(route, stretch)),
  );
  return index === -1 ? 0 : index;
}

// The stretches, with the road just left (the line `ahead` of where the rider last was on it) added.
function remember(stretches, ahead) {
  const stretch = stretchLeft(ahead);
  const known = stretches || [];
  return stretch.length ? [...known, stretch].slice(-MAX_STRETCHES) : known;
}

// The stretches without any the rider is on now: those were open after all.
function stillClosed(stretches, rider) {
  if (!rider || !stretches || stretches.length === 0) {
    return stretches || [];
  }
  const kept = stretches.filter(
    stretch => !stretch.some(point => metres(point, rider) <= NEAR_M),
  );
  return kept.length === stretches.length ? stretches : kept;
}

module.exports = {
  stretchLeft,
  takesStretch,
  routeAvoiding,
  remember,
  stillClosed,
  LEFT_STRETCH_M,
  JUNCTION_M,
  NEAR_M,
};
