import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyFix,
  easeAngle,
  easeProgress,
  measureRoute,
  pointAtProgress,
  predictProgress,
  remainingRoute,
} from './vehicleTracker';
import { bearingDegrees, distanceMeters } from './navMath';

// Redraw at most ~30 times a second.
const FRAME_MS = 33;
// The route line is re-cut every few meters, not every frame (it is a long
// native update; the gap hides under the vehicle marker).
const LINE_STEP_METERS = 5;

const EMPTY = {
  coord: null,
  heading: 0,
  onRoute: false,
  offRouteMeters: 0,
  remaining: null,
};

const lerp = (a, b, k) => ({
  latitude: a.latitude + (b.latitude - a.latitude) * k,
  longitude: a.longitude + (b.longitude - a.longitude) * k,
});

/**
 * Drives the rider marker on the passenger map from the rider's GPS fixes.
 *
 * On the route: the marker runs along the road at the rider's estimated
 * speed, ahead of the last (already a-few-seconds-old) fix, never backwards,
 * pointing along the road. Off the route (or before a route is loaded): it
 * glides to the raw GPS position and points the way it is moving.
 *
 * fix: { latitude, longitude, at, id, heardAt } | null   (see vehicleTracker.applyFix)
 * Returns { coord, heading, onRoute, offRouteMeters, remaining }.
 */
const useVehicleTracker = ({ routeCoords, fix, enabled }) => {
  const route = useMemo(() => measureRoute(routeCoords), [routeCoords]);
  const routeRef = useRef(route);
  const stateRef = useRef(null);
  const lastFixRef = useRef(null);
  const shownRef = useRef(null); // drawn progress along the route (m)
  const coordRef = useRef(null); // drawn coordinate
  const headingRef = useRef(null);
  const lineStepRef = useRef(null);
  const remainingRef = useRef(null);
  const [view, setView] = useState(EMPTY);

  const hasRoute = route.coords.length > 1;

  // A new route (new leg, or a reroute): start over on it from the latest fix.
  useEffect(() => {
    routeRef.current = route;
    shownRef.current = null;
    lineStepRef.current = null;
    remainingRef.current = null;
    stateRef.current =
      hasRoute && lastFixRef.current
        ? applyFix(null, route, lastFixRef.current)
        : null;
  }, [route, hasRoute]);

  const fixId = fix ? fix.id : null;
  const fixAt = fix ? fix.at : null;
  const fixHeardAt = fix ? fix.heardAt : null;
  useEffect(() => {
    if (!fix) {
      lastFixRef.current = null;
      stateRef.current = null;
      shownRef.current = null;
      coordRef.current = null;
      headingRef.current = null;
      lineStepRef.current = null;
      remainingRef.current = null;
      setView(EMPTY);
      return;
    }
    lastFixRef.current = fix;
    if (routeRef.current.coords.length > 1) {
      stateRef.current = applyFix(stateRef.current, routeRef.current, fix);
    }
    // fix identity (id/at/heardAt) is what matters, not the object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixId, fixAt, fixHeardAt]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let frame;
    let last = Date.now();
    let lastPaint = 0;
    let painted = null;

    const tick = () => {
      const now = Date.now();
      const dt = Math.min((now - last) / 1000, 0.5);
      last = now;
      const state = stateRef.current;
      const raw = lastFixRef.current;

      let coord = null;
      let onRoute = false;
      let offRouteMeters = 0;

      if (state && !state.offRoute) {
        // On the road: run along it toward "where the rider is now".
        const target = predictProgress(state, now);
        shownRef.current = easeProgress(shownRef.current, target, dt);
        const at = pointAtProgress(state.route, shownRef.current);
        coord = { latitude: at.latitude, longitude: at.longitude };
        headingRef.current = easeAngle(headingRef.current, at.bearing, dt);
        onRoute = true;
        offRouteMeters = state.offMeters;
        const step = Math.floor(shownRef.current / LINE_STEP_METERS);
        if (step !== lineStepRef.current) {
          lineStepRef.current = step;
          remainingRef.current = remainingRoute(
            state.route,
            step * LINE_STEP_METERS,
          );
        }
      } else if (raw) {
        // Off the road, or no route yet: glide to the raw GPS position.
        const prev = coordRef.current;
        const k = 1 - Math.exp(-dt / 0.5);
        coord = prev ? lerp(prev, raw, k) : raw;
        if (prev && distanceMeters(prev, raw) >= 4) {
          headingRef.current = easeAngle(
            headingRef.current,
            bearingDegrees(prev, raw),
            dt,
          );
        }
        shownRef.current = null;
        lineStepRef.current = null;
        remainingRef.current = null;
        offRouteMeters = state ? state.offMeters : 0;
      }

      if (coord) {
        coordRef.current = coord;
        const heading = headingRef.current ?? 0;
        const changed =
          !painted ||
          painted.remaining !== remainingRef.current ||
          painted.onRoute !== onRoute ||
          Math.abs(painted.heading - heading) > 0.7 ||
          distanceMeters(painted.coord, coord) > 0.25;
        if (changed && now - lastPaint >= FRAME_MS) {
          lastPaint = now;
          painted = {
            coord,
            heading,
            onRoute,
            offRouteMeters,
            remaining: remainingRef.current,
          };
          setView(painted);
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);

  return enabled ? view : EMPTY;
};

export default useVehicleTracker;
