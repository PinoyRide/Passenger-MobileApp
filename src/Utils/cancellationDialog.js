import { CANCEL_FREE_BODY } from './cancellationPolicy.js';

// Every passenger cancel confirmation uses the in-app Figma dialog. The
// backend preview still determines whether an actual fee is displayed.
export const freeCancellationPreview = (bookingId = null) => ({
  booking_id: bookingId,
  penalty_applies: false,
  penalty_amount: 0,
});

export const cancellationConfirmationCopy = CANCEL_FREE_BODY;
