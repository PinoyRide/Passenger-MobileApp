// Passenger advance-cancel copy must match the backend rule:
// free within 5 minutes of rider acceptance (even inside the 2-hour window),
// free when pickup is still >=120 minutes away, otherwise the backend's
// cancellation_policy.passenger_cancel_penalty_percent of the estimated fare.
export const CANCEL_GRACE_MINUTES = 5;

// Returns the percent as display text ("20", "12.5"), or null when the
// backend value is missing or not a usable 0-100 number.
export const cancelPenaltyPercent = pct => {
  if (pct == null || pct === '' || typeof pct === 'object') {
    return null;
  }
  const n = Number(pct);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return null;
  }
  return String(Number(n.toFixed(2)));
};

export const passengerCancellationNotice = pct => {
  const p = cancelPenaltyPercent(pct);
  const penalty = p
    ? `a ${p}% penalty of the estimated fare`
    : 'a cancellation penalty based on the estimated fare';
  return `Notice: Cancellation is free if no rider has accepted yet, for ${CANCEL_GRACE_MINUTES} minutes after a rider accepts (even inside the 2-hour window), when pickup is 2 or more hours away, or if the rider is a no-show 30 minutes after pickup. After that grace, cancelling within 2 hours of pickup incurs ${penalty} and counts as 1 violation.`;
};

export const cancelWithPenaltyBody = pct => {
  const p = cancelPenaltyPercent(pct);
  const penalty = p
    ? `A cancellation penalty of ${p}% of the estimated fare will be applied.`
    : 'A cancellation penalty based on the estimated fare will be applied.';
  return `Are you sure you want to cancel this advance booking? The ${CANCEL_GRACE_MINUTES}-minute free-cancel grace after rider acceptance has passed, and pickup is within 2 hours. ${penalty}`;
};

export const CANCEL_FREE_BODY =
  'Are you sure you want to cancel this advance booking? No cancellation penalty applies.';
