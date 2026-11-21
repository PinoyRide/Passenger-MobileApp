// Live vehicle tracking for the passenger map. Pure (no RN imports) so it runs
// under `node --test`.
//
// The rider's phone reports a GPS fix about once a second; by the time the
// passenger's phone has it, the fix is 2-4 s old. Drawing the raw fix makes
// the vehicle trail behind (and jump back when updates arrive out of order).
// Instead, each fix is pinned onto the route line and the vehicle is drawn at
// "where it should be now": fix position + speed x age, along the road.
// It never moves backwards, and its heading is the direction of the road.
//
// Times: `at` is when the GPS took the fix and `heardAt` is when the rider's
// phone last reported in, both on this phone's clock. A phone that keeps
// reporting in with no newer fix is standing still.
const { bearingDegrees, distanceMeters } = require('./navMath');

// Farther than this from the route line means the rider left the route.
const OFF_ROUTE_METERS = 40;
// Predict at most this far past the last fix (rider stopped reporting).
const MAX_LEAD_SECONDS = 5;
// Speed is measured across the last few fixes (not just the last two), so a
// fix whose time or position is a little off cannot swing it.
const SPEED_WINDOW_MS = 6000;
const SPEED_FIXES = 4;
// The rider's phone reported in this long after its latest fix without a
// newer one: it has not moved, so stop predicting it forward.
const STANDING_AFTER_MS = 3000;
// Cap for the speed estimate (126 km/h).
const MAX_SPEED_MPS = 35;
// Below this the vehicle counts as stopped.
const STOPPED_MPS = 0.7;
// With a previous position, only look this far back/ahead on the route, so a
// route that loops near itself can't pin the vehicle to the wrong pass.
const SEARCH_BACK_METERS = 60;
const SEARCH_AHEAD_METERS = 500;
// Two parts of the route this far apart (along the road) are separate passes;
// when both are within this much of equally near, the earlier pass wins.
const SEPARATE_PASS_METERS = 50;
const SAME_DISTANCE_METERS = 15;
// How quickly the drawn position closes the gap to the prediction.
const EASE_SECONDS = 0.35;

/** Adds cumulative distances so positions can be expressed as meters along the route. */
function measureRoute(coords) {
  const pts = Array.isArray(coords) ? coords : [];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + distanceMeters(pts[i - 1], pts[i]));
  }
  return { coords: pts, cum, length: cum[cum.length - 1] || 0 };
}

function projectOnSegment(a, b, p, kx, tMin, tMax) {
  const ax = a.longitude * kx;
  const bx = b.longitude * kx;
  const px = p.longitude * kx;
  const dx = bx - ax;
  const dy = b.latitude - a.latitude;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (p.latitude - a.latitude) * dy) / len2 : 0;
  t = Math.max(tMin, Math.min(tMax, t));
  return {
    t,
    point: {
      latitude: a.latitude + t * (b.latitude - a.latitude),
      longitude: a.longitude + t * (b.longitude - a.longitude),
    },
  };
}

/**
 * Nearest point on the route to `point`, as { progress (meters from the
 * start), offMeters }. `hintProgress` (the last known progress) limits the
 * search to the nearby stretch of the route. When two separate passes of the
 * route are about equally close (a U-turn, a loop), the earlier one wins:
 * the vehicle reaches the later pass only by driving there.
 */
function projectOnRoute(route, point, hintProgress) {
  const { coords, cum } = route;
  if (!point || coords.length < 2) {
    return null;
  }
  const kx = Math.cos((point.latitude * Math.PI) / 180);
  const hinted = hintProgress != null;
  const lo = hinted ? hintProgress - SEARCH_BACK_METERS : -Infinity;
  const hi = hinted ? hintProgress + SEARCH_AHEAD_METERS : Infinity;
  const candidates = [];
  let best = null;
  for (let i = 0; i < coords.length - 1; i++) {
    if (cum[i + 1] < lo || cum[i] > hi) {
      continue;
    }
    const span = cum[i + 1] - cum[i];
    // Only the part of this segment inside the search window counts.
    const tMin = span > 0 ? Math.max(0, (lo - cum[i]) / span) : 0;
    const tMax = span > 0 ? Math.min(1, (hi - cum[i]) / span) : 1;
    const { t, point: on } = projectOnSegment(
      coords[i],
      coords[i + 1],
      point,
      kx,
      tMin,
      tMax,
    );
    const candidate = {
      progress: cum[i] + t * span,
      offMeters: distanceMeters(point, on),
    };
    candidates.push(candidate);
    if (!best || candidate.offMeters < best.offMeters) {
      best = candidate;
    }
  }
  if (!best) {
    return null;
  }
  // With history, an "earlier pass" must still be at or ahead of where the
  // vehicle already was: after a U-turn the outbound side is behind it.
  const floor = hinted ? hintProgress - 5 : -Infinity;
  const earlierPass = candidates.find(
    c =>
      c.progress >= floor &&
      best.progress - c.progress > SEPARATE_PASS_METERS &&
      c.offMeters <= best.offMeters + SAME_DISTANCE_METERS,
  );
  return earlierPass || best;
}

/** The point and road direction `progress` meters along the route. */
function pointAtProgress(route, progress) {
  const { coords, cum, length } = route;
  if (coords.length === 0) {
    return null;
  }
  if (coords.length === 1) {
    return { ...coords[0], bearing: 0, index: 0 };
  }
  const p = Math.max(0, Math.min(progress, length));
  let lo = 0;
  let hi = coords.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid + 1] < p) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  // Skip zero-length segments when reading the road direction.
  let seg = lo;
  while (seg < coords.length - 2 && cum[seg + 1] - cum[seg] < 0.01) {
    seg++;
  }
  const span = cum[lo + 1] - cum[lo];
  const t = span > 0 ? (p - cum[lo]) / span : 0;
  const a = coords[lo];
  const b = coords[lo + 1];
  return {
    latitude: a.latitude + t * (b.latitude - a.latitude),
    longitude: a.longitude + t * (b.longitude - a.longitude),
    bearing: bearingDegrees(coords[seg], coords[seg + 1]),
    index: lo,
  };
}

/**
 * Folds a GPS fix into the tracking state.
 * fix: { latitude, longitude, at, id, heardAt } where `at` is the local time
 * (ms) the fix was taken, `id` identifies the fix (the same fix polled twice
 * must not look like "the rider stopped") and `heardAt` (optional) is the
 * local time the rider's phone last reported in.
 */
function applyFix(prevState, route, fix) {
  const prev = prevState && prevState.route === route ? prevState : null;
  const heardAt = fix.heardAt != null ? fix.heardAt : null;
  if (prev && fix.id != null && fix.id === prev.fixId) {
    // The same fix again. Nothing new about where the rider is, only that
    // their phone has reported in since without a newer position.
    return heardAt != null && heardAt > (prev.heardAt || 0)
      ? { ...prev, heardAt }
      : prev;
  }
  if (prev && fix.at <= prev.fixAt) {
    return prev; // older than what we already have
  }
  const hint = prev && !prev.offRoute ? prev.fixProgress : null;
  let proj = projectOnRoute(route, fix, hint);
  if (hint != null && (!proj || proj.offMeters > OFF_ROUTE_METERS)) {
    proj = projectOnRoute(route, fix, null); // lost it nearby: look everywhere
  }
  const base = {
    route,
    raw: { latitude: fix.latitude, longitude: fix.longitude },
    fixAt: fix.at,
    fixId: fix.id,
    heardAt,
  };
  if (!proj || proj.offMeters > OFF_ROUTE_METERS) {
    return {
      ...base,
      offRoute: true,
      offMeters: proj ? proj.offMeters : Infinity,
      fixProgress: prev ? prev.fixProgress : 0,
      speed: 0,
      history: [],
    };
  }

  let progress = proj.progress;
  let speed = 0;
  let history = [{ at: fix.at, progress }];
  if (prev && !prev.offRoute) {
    // GPS jitter must not pull the vehicle back along the road.
    progress = Math.max(progress, prev.fixProgress);
    const stepSeconds = (fix.at - prev.fixAt) / 1000;
    const step = (progress - prev.fixProgress) / stepSeconds;
    if (stepSeconds >= 0.25 && step < STOPPED_MPS) {
      // Stopped: forget the speed it had, and measure afresh from here.
      history = [{ at: fix.at, progress }];
    } else {
      history = [...(prev.history || []), { at: fix.at, progress }]
        .filter(h => fix.at - h.at <= SPEED_WINDOW_MS)
        .slice(-SPEED_FIXES);
      const first = history[0];
      const seconds = (fix.at - first.at) / 1000;
      // Too little time to measure over: keep the speed it had.
      speed =
        seconds >= 0.5
          ? Math.min((progress - first.progress) / seconds, MAX_SPEED_MPS)
          : prev.speed;
    }
  }
  return {
    ...base,
    offRoute: false,
    offMeters: proj.offMeters,
    fixProgress: progress,
    speed,
    history,
  };
}

/** Where the vehicle should be at `now`: the last fix plus speed x age (capped). */
function predictProgress(state, now) {
  if (!state || state.offRoute) {
    return null;
  }
  if (
    state.heardAt != null &&
    state.heardAt - state.fixAt > STANDING_AFTER_MS
  ) {
    return state.fixProgress; // standing still since that fix
  }
  const lead = Math.max(
    0,
    Math.min((now - state.fixAt) / 1000, MAX_LEAD_SECONDS),
  );
  return Math.min(state.fixProgress + state.speed * lead, state.route.length);
}

/** Moves the drawn progress toward the prediction. Never backwards. */
function easeProgress(shown, target, dtSeconds) {
  if (shown == null) {
    return target;
  }
  if (target <= shown) {
    return shown;
  }
  const k = 1 - Math.exp(-Math.max(0, dtSeconds) / EASE_SECONDS);
  return shown + (target - shown) * k;
}

/** Turns `from` toward `to` degrees along the shorter way round. */
function easeAngle(from, to, dtSeconds, seconds = 0.25) {
  if (from == null) {
    return to;
  }
  const diff = ((to - from + 540) % 360) - 180;
  const k = 1 - Math.exp(-Math.max(0, dtSeconds) / seconds);
  return (from + diff * k + 360) % 360;
}

/** The route still ahead of the vehicle: from `progress` to the end. */
function remainingRoute(route, progress) {
  const at = pointAtProgress(route, progress);
  if (!at) {
    return [];
  }
  return [
    { latitude: at.latitude, longitude: at.longitude },
    ...route.coords.slice(at.index + 1),
  ];
}

module.exports = {
  OFF_ROUTE_METERS,
  MAX_LEAD_SECONDS,
  measureRoute,
  projectOnRoute,
  pointAtProgress,
  applyFix,
  predictProgress,
  easeProgress,
  easeAngle,
  remainingRoute,
};
