import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import usePostRequest from '@/Services/Api';
import { Constants } from '@/Utils';

const POLL_MS = 15000;

/**
 * Home only tracked bookings stored in Redux (the ones created in this app
 * session), so an advance booking accepted later, or created elsewhere, never
 * reached the live-status poll. While Home is focused and nothing is tracked,
 * check get_upcoming and adopt the first advance booking a rider has taken
 * (status 1 heading to pickup, or status 5 with a rider assigned).
 */
export const pickTrackableUpcoming = bookings => {
  if (!Array.isArray(bookings)) {
    return null;
  }
  const hasRider = b =>
    b?.rider_assigned === true ||
    Boolean(b?.rider_details && b.rider_details.id);
  return (
    bookings.find(b => Number(b.status) === 2) ||
    bookings.find(b => Number(b.status) === 1) ||
    bookings.find(b => Number(b.status) === 5 && hasRider(b)) ||
    null
  );
};

const useAdvanceBookingDiscovery = ({
  customerId,
  enabled,
  isOnline = true,
  onFound,
}) => {
  const api = usePostRequest();
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;
  const focusedRef = useRef(false);

  const check = useCallback(async () => {
    if (!customerId || !isOnline) {
      return;
    }
    const { response } = await api.makePostRequest(
      Constants.ENDPOINT.GET_UPCOMING_BOOKINGS,
      { customer_id: customerId, page: 1 },
    );
    const found = pickTrackableUpcoming(response?.data?.bookings);
    if (found) {
      onFoundRef.current?.(found);
    }
  }, [customerId, isOnline]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !isOnline) {
        return undefined;
      }
      check();
      const id = setInterval(() => {
        if (focusedRef.current) {
          check();
        }
      }, POLL_MS);
      return () => clearInterval(id);
    }, [enabled, isOnline, check]),
  );
};

export default useAdvanceBookingDiscovery;
