import { useEffect, useRef, useState } from 'react';

export const NO_RIDERS_TIMEOUT_MS = 5 * 60 * 1000;

const parseTime = value => {
  if (!value) {
    return null;
  }
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
};

/**
 * True once an unaccepted booking has waited 5 min since the server's
 * creation (or last re-pool) time. Survives reloads because the base time
 * comes from the booking itself. `restart(serverTime?)` resets the clock
 * after Try Again.
 */
// date_created "YYYY-MM-DD" + time_created "hh:mm AM" (Manila local, minute precision).
const parseCreatedParts = (date, time) => {
  if (!date || !time) {
    return null;
  }
  const m = String(time)
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/i);
  if (!m) {
    return null;
  }
  let h = Number(m[1]) % 12;
  if (m[3] && m[3].toUpperCase() === 'PM') {
    h += 12;
  } else if (!m[3]) {
    h = Number(m[1]);
  }
  const hh = String(h).padStart(2, '0');
  return parseTime(`${date}T${hh}:${m[2]}:00+08:00`);
};

const useNoRidersTimer = ({ booking, waiting, serverOffsetMs = 0 }) => {
  const [expired, setExpired] = useState(false);
  const localBaseRef = useRef({ id: null, restartedAt: null, firstSeen: null });

  const bookingId = booking?.id ?? null;
  if (localBaseRef.current.id !== bookingId) {
    localBaseRef.current = {
      id: bookingId,
      restartedAt: null,
      firstSeen: null,
    };
  }
  const serverBase =
    parseTime(booking?.pooled_at) ??
    parseTime(booking?.created_at) ??
    parseCreatedParts(booking?.date_created, booking?.time_created);
  // A Try Again restart wins over the server time; the first-seen local time
  // is only a fallback when the booking carries no server timestamp.
  const { restartedAt, firstSeen } = localBaseRef.current;
  const base =
    restartedAt != null
      ? Math.max(restartedAt, serverBase ?? 0)
      : serverBase ?? firstSeen ?? null;

  // Unmount / booking change: make sure nothing fires afterwards.
  useEffect(() => () => setExpired(false), [bookingId]);

  useEffect(() => {
    setExpired(false);
    if (!waiting || !bookingId) {
      return undefined;
    }
    const start = base ?? Date.now() + serverOffsetMs;
    if (base == null) {
      localBaseRef.current.firstSeen = start;
    }
    const remaining =
      start + NO_RIDERS_TIMEOUT_MS - (Date.now() + serverOffsetMs);
    if (remaining <= 0) {
      setExpired(true);
      return undefined;
    }
    const id = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(id);
  }, [waiting, bookingId, base, serverOffsetMs]);

  const restart = serverTime => {
    localBaseRef.current.restartedAt =
      parseTime(serverTime) ?? Date.now() + serverOffsetMs;
    setExpired(false);
  };

  return { expired: waiting && expired, restart };
};

export default useNoRidersTimer;
