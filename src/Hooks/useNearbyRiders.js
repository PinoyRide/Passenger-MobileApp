import { useCallback, useEffect, useRef, useState } from 'react';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';
import { makeNearbyAsker } from '@/Utils/nearbyAsker';

// How long the riders stay on the map after a press (the owner, 2026-11-22:
// "we will give only 30 seconds for it then it will auto off").
const SHOWN_MS = 30000;
// A press this soon after the last answer, for about the same spot, shows
// that answer again instead of asking: pressing on and off asks at most once
// in this long.
const REUSE_MS = 15000;

// To about 100 m, the spot an answer belongs to.
const near = value =>
  value == null || !Number.isFinite(Number(value))
    ? null
    : Math.round(Number(value) * 1000) / 1000;

// The "Riders nearby" button: one call per press, nothing in between (the
// owner, 2026-11-22: "call only the api when the riders nearby is clicked",
// "make sure that the api call for rider nearby only call once when we click
// the button"; Utils/nearbyAsker.js keeps to that). show(point) asks for the
// online riders within reach of the point (4 km, the backend's NearbyRiders)
// who are not booked or in transit; what comes back stays for 30 s, then goes
// by itself, and hide() takes it away sooner. `nearby` is null while nothing
// is shown, else { looking: true }, { count, riders: [{ lat, long }], reachKm },
// { failed: true }, or { unknown: true } (no point to ask about).
export default function useNearbyRiders() {
  const { request } = useApiRequest();
  const requestRef = useRef(request);
  requestRef.current = request;
  const [nearby, setNearby] = useState(null);
  // counts presses (and hides): what an older one finds is not shown
  const pressRef = useRef(0);
  const timerRef = useRef(null);
  const askerRef = useRef(null);
  if (!askerRef.current) {
    askerRef.current = makeNearbyAsker({
      reuseMs: REUSE_MS,
      fetchSpot: async spot => {
        const [la, lo] = spot.split(',').map(Number);
        const { response } = await requestRef.current(
          'GET',
          Constants.API.NEARBY_RIDERS({ lat: la, long: lo }),
        );
        const data = response?.data;
        return data && Number.isFinite(Number(data.count))
          ? {
              count: Number(data.count),
              riders: Array.isArray(data.riders) ? data.riders : [],
              // how far the backend looked, for the label
              reachKm: data.reachKm ?? null,
            }
          : null;
      },
    });
  }

  const hide = useCallback(() => {
    pressRef.current += 1;
    clearTimeout(timerRef.current);
    setNearby(null);
  }, []);

  // what press `press` found, shown for SHOWN_MS
  const put = (press, value) => {
    if (press !== pressRef.current) {
      return;
    }
    setNearby(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (press === pressRef.current) {
        setNearby(null);
      }
    }, SHOWN_MS);
  };

  const show = async point => {
    const press = ++pressRef.current;
    clearTimeout(timerRef.current);
    const la = near(point?.lat);
    const lo = near(point?.long);
    if (la == null || lo == null) {
      put(press, { unknown: true });
      return;
    }
    const spot = `${la},${lo}`;
    const kept = askerRef.current.fresh(spot);
    if (kept) {
      put(press, kept);
      return;
    }
    setNearby({ looking: true });
    const answer = await askerRef.current.ask(spot);
    put(press, answer ?? { failed: true });
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { nearby, show, hide };
}
