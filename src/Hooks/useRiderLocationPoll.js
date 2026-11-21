import { useEffect, useRef } from 'react';
import usePostRequest from '@/Services/Api';
import { Constants } from '@/Utils';

const POLL_MS = 1000;

/**
 * Polls POST booking/get_rider_location every second while a rider is heading
 * to pickup (status 1) or the trip is under way (status 2), for the live map.
 *
 * Each fix is reported as { lat, long, at, id, heardAt }:
 *  - at: the local time (ms) the rider's GPS took the fix, worked out from
 *    the server-reported age, so the map can place the rider where they are
 *    now rather than where they were;
 *  - id: the fix's own timestamp. It only changes when the rider's position
 *    does, so the same fix polled twice is not mistaken for a new one;
 *  - heardAt: the local time (ms) the rider's phone last reported in. Later
 *    than `at` by more than a few seconds means the rider is standing still.
 */
const useRiderLocationPoll = ({ bookingId, customerId, enabled, onFix }) => {
  const api = usePostRequest();
  const onFixRef = useRef(onFix);
  onFixRef.current = onFix;

  useEffect(() => {
    if (!enabled || !bookingId) {
      return undefined;
    }
    let cancelled = false;
    let timer;
    const tick = async () => {
      const sentAt = Date.now();
      const { response } = await api.makePostRequest(
        Constants.ENDPOINT.GET_RIDER_LOCATION,
        { booking_id: bookingId, customer_id: customerId },
      );
      if (cancelled) {
        return;
      }
      const d = response?.data;
      if (d && d.lat != null && d.long != null) {
        const receivedAt = Date.now();
        // Half the round trip is the trip back from the server.
        const travel = Math.min((receivedAt - sentAt) / 2, 1000);
        const serverAt = receivedAt - travel; // when the server answered
        onFixRef.current?.({
          lat: d.lat,
          long: d.long,
          at: serverAt - (Number(d.age_ms) || 0),
          id: d.updated_at || `${d.lat},${d.long}`,
          heardAt: d.heard_ms != null ? serverAt - Number(d.heard_ms) : null,
        });
      }
      const elapsed = Date.now() - sentAt;
      timer = setTimeout(tick, Math.max(200, POLL_MS - elapsed));
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // api is a new object every render; the poll is keyed on the booking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, bookingId, customerId]);
};

export default useRiderLocationPoll;
