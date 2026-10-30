import { useEffect, useRef, useState } from 'react';

// Glides a coordinate from its previous value to the new one over durationMs,
// so the rider marker (and the track line tied to it) moves smoothly between
// 2-second location polls instead of jumping, like Grab.
export const lerpCoord = (from, to, t) => ({
  latitude: from.latitude + (to.latitude - from.latitude) * t,
  longitude: from.longitude + (to.longitude - from.longitude) * t,
});

const useSmoothCoord = (target, durationMs = 1800) => {
  const [coord, setCoord] = useState(target);
  const currentRef = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    const from = currentRef.current;
    if (!target || !from) {
      currentRef.current = target;
      setCoord(target);
      return undefined;
    }
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const eased = t * (2 - t); // ease-out
      const next = lerpCoord(from, target, eased);
      currentRef.current = next;
      setCoord(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, durationMs]);

  return coord;
};

export default useSmoothCoord;
