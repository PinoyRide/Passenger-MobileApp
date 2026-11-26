import { store } from '@/Redux/store';
import { getCurrentRouteName } from '@/Utils/NavigationService';
import { busyReason } from '@/Utils/updateWhenReady';

// What a restart into an update would cut off in the Passenger app right now
// (useUpdateWhenReady), or null when nothing would: a booking waiting for a
// rider, accepted or under way; a booking being placed (the fare summary is
// up, `isBooked`, before the booking exists, and the fare breakdown after a
// trip); a payment; a screen with something half done.
export const passengerBusy = () => {
  const user = store.getState().user || {};
  return busyReason({
    bookingId: user.activeBooking?.id,
    bookingStatus: user.bookingStatus,
    requestOnScreen:
      !user.activeBooking && Boolean(user.isBooked || user.isConfirmed),
    screen: getCurrentRouteName(),
  });
};
