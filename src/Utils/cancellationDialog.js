import { useRef } from 'react';
import {
  CANCEL_FREE_BODY,
  cancelWithPenaltyBody,
} from './cancellationPolicy.js';

// Passenger cancel: ask the backend (cancel_advance preview) first, then show
// exactly one dialog. Never say "no penalty" before or without a preview.
export const CANCEL_PREVIEW_CHECKING_BODY = 'Checking the cancellation fee…';
export const CANCEL_PREVIEW_FAILED_BODY =
  "We couldn't check the cancellation fee. Please try again.";

const truthyFlag = v =>
  v === true ||
  v === 1 ||
  ['1', 'true', 'yes'].includes(String(v).toLowerCase());

// Advance if the backend flags it (is_advance / "Advance Booking" label) or it
// carries a scheduled pickup, or the passenger picked a date on this screen.
export const isAdvanceBooking = (booking, scheduledAt = null) =>
  Boolean(
    truthyFlag(booking?.is_advance) ||
      /advance/i.test(String(booking?.booking_label || '')) ||
      booking?.scheduled_pickup_at ||
      booking?.scheduled_at ||
      scheduledAt,
  );

// 'cancel_advance' (preview + priced cancel), 'update_status' (instant only)
// or 'error' (advance we can't preview: never fall back to a free cancel).
export const cancelRoute = (booking, scheduledAt = null, bookingIdOverride) => {
  if (!isAdvanceBooking(booking, scheduledAt)) {
    return 'update_status';
  }
  return bookingIdOverride ?? booking?.id ? 'cancel_advance' : 'error';
};

// Any failure, 404 included, or a reply without a boolean penalty_applies is
// an error. Only "Not an advance booking" (server checked) means instant.
export const cancelPreviewOutcome = ({ response, error } = {}) => {
  if (error) {
    const msg = String(error);
    if (/no longer be cancelled/i.test(msg)) {
      return { kind: 'replaced' };
    }
    if (/not an advance booking/i.test(msg)) {
      return { kind: 'instant' };
    }
    return { kind: 'error' };
  }
  const preview = response?.data ?? response;
  if (!preview || typeof preview.penalty_applies !== 'boolean') {
    return { kind: 'error' };
  }
  return { kind: 'ready', preview };
};

// update_status_for_customer on a booking that turns out to be advance with a
// fee: backend answers 409 error_code "use_cancel_advance" and changes nothing.
// Api.js only passes the message on, so match it as well as the code.
export const updateStatusCancelOutcome = ({ response, error } = {}) => {
  const code = response?.data?.error_code ?? response?.error_code;
  if (
    code === 'use_cancel_advance' ||
    /use_cancel_advance|use booking\/cancel_advance|cancellation fee applies/i.test(
      String(error || ''),
    )
  ) {
    return 'use_cancel_advance';
  }
  return error ? 'error' : 'cancelled';
};

// Free confirmation for an instant booking (update_status never charges).
export const instantCancelPreview = (bookingId = null) => ({
  booking_id: bookingId,
  penalty_applies: false,
  instant: true,
});

export const cancelDialogState = ({
  checking = false,
  failed = false,
  penaltyApplies = false,
  penaltyPercent,
} = {}) => {
  const base = { showAmount: false, yesLabel: 'Yes', noLabel: 'No' };
  if (checking) {
    return {
      ...base,
      mode: 'loading',
      title: 'Cancel Booking',
      body: CANCEL_PREVIEW_CHECKING_BODY,
      buttonsDisabled: true,
    };
  }
  if (failed) {
    return {
      ...base,
      mode: 'error',
      title: 'Cancel Booking',
      body: CANCEL_PREVIEW_FAILED_BODY,
      yesLabel: 'Retry',
      noLabel: 'Close',
    };
  }
  if (penaltyApplies) {
    return {
      ...base,
      mode: 'penalty',
      title: 'Cancel Booking with Penalty?',
      body: cancelWithPenaltyBody(penaltyPercent),
      showAmount: true,
    };
  }
  return {
    ...base,
    mode: 'free',
    title: 'Cancel Booking?',
    body: CANCEL_FREE_BODY,
  };
};

// What Yes does on the dialog: 'none' while busy, 'retry' the preview after a
// failure, 'penalty' confirms the priced cancel, 'free' cancels.
export const cancelYesAction = (preview, busy) => {
  if (busy || !preview) {
    return 'none';
  }
  if (preview.failed) {
    return 'retry';
  }
  return preview.penalty_applies ? 'penalty' : 'free';
};

// The ref closes the async double-tap gap before React renders loading.
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
