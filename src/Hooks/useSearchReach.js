import { useEffect, useMemo, useState } from 'react';
import { nextWideningIn, reachKmAt, stepsOf } from '@/Utils/searchReach';

// How far a waiting booking's search reaches now, in km (Utils/searchReach.js),
// drawn again as each widening comes. `startedAt`: when the search began (ms,
// the server's clock; useNoRidersTimer's, so Try again starts it over);
// `offsetMs`: the server's clock minus the phone's.
export default function useSearchReach({
  booking,
  startedAt,
  active,
  offsetMs = 0,
}) {
  const stepsKey = JSON.stringify(booking?.search_steps ?? null);
  const steps = useMemo(
    () => stepsOf({ search_steps: JSON.parse(stepsKey) }),
    [stepsKey],
  );
  const [, redraw] = useState(0);
  const running = Boolean(active) && startedAt != null;
  const km = running
    ? reachKmAt(steps, Date.now() + offsetMs - startedAt)
    : steps[0].km;

  useEffect(() => {
    if (!running) {
      return undefined;
    }
    const wait = nextWideningIn(steps, Date.now() + offsetMs - startedAt);
    if (wait == null) {
      return undefined;
    }
    const timer = setTimeout(() => redraw(n => n + 1), wait + 200);
    return () => clearTimeout(timer);
  }, [running, steps, startedAt, offsetMs, km]);

  return km;
}
