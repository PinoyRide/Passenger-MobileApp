// The Passenger wallet is locked until the ID check (eKYC) has passed
// (WALLET-EKYC-LOCK, the owner A-325, 2026-11-26): the server refuses Cash in,
// the top-up number, Cash out and paying a ride with the wallet with a 403
// whose `data.reason` is ekyc_required (never a 401: nobody is signed out),
// and the wallet answer (customers/{id}/wallet) says so in `locked`. The app
// says the owner's sentence with a Verify ID button, which starts the ID check
// on the Wallet page, and starts every ride on cash (Utils/startingPayment.js).
// An answer without `locked` (an API from before the lock) is not locked: the
// server still refuses, and its message is the same sentence.
// Pure (no RN imports) so it runs under `node --test`. Passenger only.

const LOCKED_REASON = 'ekyc_required';
const LOCKED_MESSAGE = 'Verify your ID to use your wallet.';
// the box's body under the owner's sentence (Q-UX-WALLET-EKYC-LOCK-WORDS item
// 1): true while locked, the lock only stops the money being used
const LOCKED_BODY =
  'The check takes a few minutes. Until then your rides start on cash. ' +
  'Money already in your wallet stays there.';
const VERIFY_LABEL = 'Verify ID';

// Whether the wallet answer says the wallet is locked.
const walletLocked = wallet => wallet?.locked === true;

// Whether a refusal is the lock, by its reason code (a string, or what
// usePostRequest answered / holds: { reason }), never by its words.
const isLockedRefusal = refusal =>
  (typeof refusal === 'string' ? refusal : refusal?.reason) === LOCKED_REASON;

// The box, as appAlert's arguments: the sentence and its body. With `onVerify`: Cancel (quiet) and
// Verify ID (filled). Without it (a check already being checked, or none can
// be started today): one OK, with `note` saying where the check stands.
function lockedAlert(onVerify, { note } = {}) {
  if (typeof onVerify !== 'function') {
    return [LOCKED_MESSAGE, LOCKED_BODY, undefined, note ? { note } : {}];
  }
  return [
    LOCKED_MESSAGE,
    LOCKED_BODY,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: VERIFY_LABEL, onPress: onVerify },
    ],
  ];
}

// Verify ID on any other screen: the Wallet page, which starts the check when
// it sees a new `verifyAt` (navigation.navigate(...verifyParams())). `pop`:
// back to the Wallet page already open under the screen (Cash in opened from
// it), not a second one on top (React Navigation 7 pushes a new one without
// it; app code review Low); a new one only when none is open.
const verifyParams = (now = Date.now()) => [
  'WalletScreen',
  { verifyAt: now },
  { pop: true },
];

module.exports = {
  LOCKED_REASON,
  LOCKED_MESSAGE,
  LOCKED_BODY,
  VERIFY_LABEL,
  walletLocked,
  isLockedRefusal,
  lockedAlert,
  verifyParams,
};
