import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';

// How often the map asks again while the riders are shown.
const EVERY_MS = 15000;

// To about 100 m: the person's own position moves a little all the time, and
// that must not ask again each time.
const near = value =>
  value == null || !Number.isFinite(Number(value))
    ? null
    : Math.round(Number(value) * 1000) / 1000;

// The "Riders nearby" button's riders (the owner, 2026-11-22: online, within
// 2 km, not booked or in transit; the backend's NearbyRiders decides). While
// `shown` and the point is known: asked at once, again every 15 s while the
// app is in front, and when the point moves. Returns null while not shown or
// not answered yet, { count, riders: [{ lat, long }] } once answered, or
// { failed: true } when the first ask failed.
export default function useNearbyRiders({ shown, lat, long }) {
  const { request } = useApiRequest();
  const requestRef = useRef(request);
  requestRef.current = request;
  const [answer, setAnswer] = useState(null);
  const la = near(lat);
  const lo = near(long);

  useEffect(() => {
    if (!shown || la == null || lo == null) {
      setAnswer(null);
      return undefined;
    }
    let alive = true;
    const ask = async () => {
      const { response, error, stale } = await requestRef.current(
        'GET',
        Constants.API.NEARBY_RIDERS({ lat: la, long: lo }),
      );
      if (!alive || stale) {
        return;
      }
      const data = response?.data;
      if (data && Number.isFinite(Number(data.count))) {
        setAnswer({
          count: Number(data.count),
          riders: Array.isArray(data.riders) ? data.riders : [],
        });
      } else if (error) {
        // the riders already on the map stay; say so only when there are none
        setAnswer(previous => previous ?? { failed: true });
      }
    };
    ask();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') {
        ask();
      }
    }, EVERY_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [shown, la, lo]);

  return answer;
}
