// Passenger advance-cancel copy must match the backend rule:
// free within 5 minutes of rider acceptance (even inside the 2-hour window),
// free when pickup is still >=120 minutes away, otherwise 10% of estimated fare.
export const CANCEL_GRACE_MINUTES = 5;

export const PASSENGER_CANCELLATION_NOTICE = `Notice: Cancellation is free if no rider has accepted yet, for ${CANCEL_GRACE_MINUTES} minutes after a rider accepts (even inside the 2-hour window), when pickup is 2 or more hours away, or if the rider is a no-show 30 minutes after pickup. After that grace, cancelling within 2 hours of pickup incurs a 10% penalty of the estimated fare and counts as 1 violation.`;

export const CANCEL_WITH_PENALTY_BODY = `Are you sure you want to cancel this advance booking? The ${CANCEL_GRACE_MINUTES}-minute free-cancel grace after rider acceptance has passed, and pickup is within 2 hours. A cancellation penalty of 10% of the estimated fare will be applied.`;

export const CANCEL_FREE_BODY =
  'Are you sure you want to cancel this advance booking? No cancellation penalty applies.';
