import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import usePostRequest from '@/Services/Api';
import { Constants } from '@/Utils';
import { riderCancelReplacement } from '@/Utils/riderCancelNotice';
import {
  removeMinimizedAdvanceBookingId,
  removeParkedAdvanceBooking,
  selectParkedAdvanceBookings,
  updateParkedAdvanceBooking,
} from '@/Redux/Slices/userSlice';

const POLL_MS = 5000;

/**
 * Keeps minimized advance bookings in sync with the server while the customer
 * books another ride on Home.
 */
const useParkedAdvanceBookingPoll = ({
  customerId,
  enabled,
  onBookingSynced,
  onRiderCancelled,
}) => {
  const dispatch = useDispatch();
  const parked = useSelector(selectParkedAdvanceBookings);
  const api = usePostRequest();
  const parkedRef = useRef(parked);
  parkedRef.current = parked;
  const onSyncedRef = useRef(onBookingSynced);
  onSyncedRef.current = onBookingSynced;
  const onRiderCancelledRef = useRef(onRiderCancelled);
  onRiderCancelledRef.current = onRiderCancelled;

  useEffect(() => {
    if (!enabled || !customerId || !parked.length) {
      return undefined;
    }

    const syncOne = async snapshot => {
      const bookingId = snapshot?.booking?.id;
      if (!bookingId) {
        return;
      }
      const { response, error } = await api.makePostRequest(
        Constants.ENDPOINT.GET_BOOKING_DETAILS,
        {
          booking_id: bookingId,
          customer_id: customerId,
        },
      );
      if (error || response?.code !== 200 || !response?.data) {
        return;
      }
      const data = response.data;
      const statusNum = Number(data.status);
      if (statusNum === 3 || statusNum === 4) {
        dispatch(removeParkedAdvanceBooking(bookingId));
        dispatch(removeMinimizedAdvanceBookingId(bookingId));
        // The rider cancelled and the ride is offered again under a new
        // reference: the passenger is told (QA LAT-16; until then this
        // dropped it without a word). Home adopts the new booking once a
        // rider accepts it (useAdvanceBookingDiscovery), as before.
        if (riderCancelReplacement(data)) {
          onRiderCancelledRef.current?.(data);
        }
        return;
      }
      dispatch(
        updateParkedAdvanceBooking({
          bookingId,
          patch: {
            booking: data,
            riderDetails: data.rider_details ?? snapshot.riderDetails,
          },
        }),
      );
      onSyncedRef.current?.(data);
    };

    const tick = () => {
      parkedRef.current.forEach(snapshot => {
        syncOne(snapshot);
      });
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, customerId, parked.length, dispatch]);
};

export default useParkedAdvanceBookingPoll;
