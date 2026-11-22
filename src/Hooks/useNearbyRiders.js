import { useCallback, useEffect, useRef, useState } from 'react';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';

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

// The "Riders nearby" button: one ask per press, nothing in between (the
// owner, 2026-11-22: "call only the api when the riders nearby is clicked").
// show(point) asks for the online riders within 2 km of the point who are not
// booked or in transit (the backend's NearbyRiders); what comes back stays
// for 30 s, then goes by itself, and hide() takes it away sooner. `nearby` is
// null while nothing is shown, else { looking: true }, { count, riders:
// [{ lat, long }] }, { failed: true }, or { unknown: true } (no point to ask
// about).
export default function useNearbyRiders() {
  const { request } = useApiRequest();
  const [nearby, setNearby] = useState(null);
  // counts presses (and hides): an answer for an older one is dropped
  const pressRef = useRef(0);
  const timerRef = useRef(null);
  const lastRef = useRef(null);

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
    const last = lastRef.current;
    if (last && last.spot === spot && Date.now() - last.at < REUSE_MS) {
      put(press, last.answer);
      return;
    }
    setNearby({ looking: true });
    const { response } = await request(
      'GET',
      Constants.API.NEARBY_RIDERS({ lat: la, long: lo }),
    );
    if (press !== pressRef.current) {
      return;
    }
    const data = response?.data;
    if (data && Number.isFinite(Number(data.count))) {
      const answer = {
        count: Number(data.count),
        riders: Array.isArray(data.riders) ? data.riders : [],
      };
      lastRef.current = { spot, at: Date.now(), answer };
      put(press, answer);
    } else {
      put(press, { failed: true });
    }
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { nearby, show, hide };
}
