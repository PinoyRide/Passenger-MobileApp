// When an open app may restart itself into a downloaded update. Pure (no RN
// imports) so it runs under `node --test`. The same file in both apps.
//
// The owner, 2026-11-22: "can we make the app even if i dont restart to force
// or trigger the update? except for the ongoing booking, intransit like
// that", then chose a true restart (a new APK: AppRestart.kt) applied right
// away. So while the app is open it looks for an update, downloads it, and
// restarts into it as soon as it is on screen and nothing would be cut off:
// not during a booking under way or being placed, not while a booking request
// is on the rider's screen, not on a payment screen, not where something is
// half done (a sign-in code already texted, a form, a photo check). In the
// background it waits, and does not ask the server: a restart there would
// bring the app up over whatever the person is doing.

// How often the server is asked while the app is on screen, and how often a
// downloaded update looks for its moment.
const CHECK_EVERY_MS = 2 * 60 * 1000;
const TICK_MS = 15 * 1000;

// booking.status values of a booking under way: waiting for a rider,
// accepted, started. Not 5: a booking scheduled for later is not under way,
// and the app finds it again after a restart.
const ONGOING_STATUSES = [0, 1, 2];

// Screens where money is moving (both apps' names).
const PAYMENT_SCREENS = [
  'CashInScreen',
  'QRPHScreen',
  'QRPH',
  'TopUpScreen',
  'CashOutScreen',
  'TransferScreen',
  'TransferConfirmationScreen',
  'BankInformationScreen',
  'PaymentOptionScreen',
  'AppTransactionComplete',
];

// Screens where something is half done and a restart would lose it: a sign-in
// code already sent (a paid text), a form or the rider's application, a photo
// or ID check, a place being chosen for a booking, a rating (both apps' names).
const UNFINISHED_SCREENS = [
  'OTPScreen',
  'DeleteAccountScreen',
  'RegisterScreen',
  'RegisterFormScreen',
  'RiderApplicationScreen',
  'VehicleStepScreen',
  'VehicleFormScreen',
  'PersonalDetailsScreen',
  'CompleteProfileScreen',
  'ConfirmDetailsScreen',
  'UploadIDScreen',
  'SelfieScreen',
  'LivenessSelfieScreen',
  'EKYCScreen',
  'InputLocation',
  'MapSelectionScreen',
  'SaveLocationScreen',
  'RatingScreen',
];

// Why a restart now would cut something off, or null when nothing would:
// 'trip' | 'request' | 'payment' | 'unfinished'. `requestOnScreen`: on the
// rider's screen, a passenger's request to accept; on the passenger's, a
// booking being placed (the fare summary, before the booking exists).
function busyReason({ bookingId, bookingStatus, requestOnScreen, screen }) {
  if (bookingId && ONGOING_STATUSES.includes(Number(bookingStatus))) {
    return 'trip';
  }
  if (requestOnScreen) {
    return 'request';
  }
  if (PAYMENT_SCREENS.includes(screen)) {
    return 'payment';
  }
  if (UNFINISHED_SCREENS.includes(screen)) {
    return 'unfinished';
  }
  return null;
}

// Restart now: an update is downloaded, the app is on screen, nothing is busy.
const shouldRestart = ({ ready, active, busy }) =>
  Boolean(ready) && Boolean(active) && !busy;

// Ask the server now: the app is on screen, nothing downloaded yet, and the
// last ask is old enough (or the app just came back to the screen).
const shouldCheck = ({ active, ready, checking, lastCheckedAt, now, force }) =>
  Boolean(active) &&
  !ready &&
  !checking &&
  (force || now - (lastCheckedAt || 0) >= CHECK_EVERY_MS);

// Update ids are UUIDs; compared without regard to case.
const sameId = (a, b) =>
  Boolean(a) &&
  Boolean(b) &&
  String(a).toLowerCase() === String(b).toLowerCase();

// After a restart into an update: did it start? `pending` is the update the
// app restarted into (kept on the phone across the restart), `running` the
// one it runs now. One that did not start (the app fell back to the one
// before) joins `refused`, and the app never restarts into it again: the
// server may still offer it, and restarting into it over and over would make
// the app unusable. Returns { refused, pending } to keep.
function afterRestart({ pending, running, refused = [] }) {
  if (!pending || sameId(pending, running)) {
    return { refused, pending: null };
  }
  return {
    refused: refused.some(id => sameId(id, pending))
      ? refused
      : [...refused, pending].slice(-10),
    pending: null,
  };
}

// Whether a downloaded update (its id) may be restarted into.
const mayRestartInto = (updateId, refused = []) =>
  Boolean(updateId) && !refused.some(id => sameId(id, updateId));

module.exports = {
  CHECK_EVERY_MS,
  TICK_MS,
  ONGOING_STATUSES,
  PAYMENT_SCREENS,
  UNFINISHED_SCREENS,
  busyReason,
  shouldRestart,
  shouldCheck,
  afterRestart,
  mayRestartInto,
};
