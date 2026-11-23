// The wait for a QR Ph payment (the Rider's Remit cash, the Passenger's Cash
// in): what an answer from qrph/check_status/ means for the waiting screen.
// Pure (no RN imports) so it runs under `node --test`. The same file in both
// apps.
//
// The backend answers `pending` until PayCools reports the payment, then
// `success`, `failed` or `expired`. Only those three end the wait. The first
// answer is nearly always `pending` (the person is still in their banking
// app), and until 2026-11-23 the screen stopped asking on it and never noticed
// the payment.

// How often the screen asks while it is in front. Timers do not run while the
// browser or the banking app is in front, so the screen also asks at once
// whenever the app comes back.
const CHECK_EVERY_MS = 5000;

// 'success', 'failed' or 'expired' end the wait; anything else is 'waiting'.
function paymentOutcome(status) {
  return status === 'success' || status === 'failed' || status === 'expired'
    ? status
    : 'waiting';
}

module.exports = { CHECK_EVERY_MS, paymentOutcome };
