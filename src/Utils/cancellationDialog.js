import { useRef } from 'react';
import { CANCEL_FREE_BODY } from './cancellationPolicy.js';

// Every passenger cancel confirmation uses the in-app Figma dialog. The
// backend preview still determines whether an actual fee is displayed.
export const freeCancellationPreview = (bookingId = null) => ({
  booking_id: bookingId,
  penalty_applies: false,
  penalty_amount: 0,
});

export const cancellationConfirmationCopy = CANCEL_FREE_BODY;

// Free confirmation dismisses immediately; priced confirmation stays visible
// until the charge request settles. The ref closes the async double-tap gap
// before React finishes rendering the loading state.
export const cancellationDecision = (penaltyApplies, busy) => ({
  dismissFree: !penaltyApplies && !busy,
  allowSubmit: !busy,
});

export const useCancellationSubmitGuard = () => {
  const submittingRef = useRef(false);
  return {
    begin: () => {
      if (submittingRef.current) {
        return false;
      }
      submittingRef.current = true;
      return true;
    },
    end: () => {
      submittingRef.current = false;
    },
  };
};
