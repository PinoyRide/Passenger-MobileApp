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

// What the screens say while locked (WALLET-LOCK-POLISH, Q-UX-WALLET-LOCK-
// POLISH F2, F3, F6, F7). The money line promises no refund: there is no way
// to send money back yet (when WALLET-REFUND-ROUTE ships it adds "or ask
// support to send it back").
const LOCKED_MONEY_LINE = 'Your money is safe. Verify your ID to use it.';
const LOCKED_CARD_NOTE = 'Locked until you verify your ID.';
// The list under the balance: the server sends a locked wallet's rows as any
// other's (customers/{id}/wallet and its history do not look at the lock), so
// an empty list is no rows yet, never rows held back by the lock.
const EMPTY_NOTE =
  'Your top-ups and ride payments will appear here once the wallet is active.';
const LOCKED_EMPTY_NOTE = 'Your top-ups and ride payments will appear here.';

// Whether the wallet answer says the wallet is locked.
const walletLocked = wallet => wallet?.locked === true;

// The label over the Wallet page's balance: locked money is not available.
const balanceLabel = locked =>
  locked === true ? 'YOUR BALANCE' : 'AVAILABLE BALANCE';

// The line under the balance: only while locked with money in the wallet.
const lockedMoneyLine = (locked, balance) =>
  locked === true && Number(balance) > 0 ? LOCKED_MONEY_LINE : null;

// The Account card's lock line: only once the answer said locked.
const lockedCardNote = locked => (locked === true ? LOCKED_CARD_NOTE : null);

// The empty transactions list's note.
const emptyTransactionsNote = locked =>
  locked === true ? LOCKED_EMPTY_NOTE : EMPTY_NOTE;

// A Cash in / Cash out tile on the Wallet page: locked, a lock and no gold
// (the words and what a tap does stay the same).
const actionLook = ({ icon, gold = false }, locked) =>
  locked === true
    ? { icon: 'lock-outline', gold: false, muted: true }
    : { icon, gold, muted: false };

// The Account card's Cash in, by what the wallet answer said: locked, the
// box; not locked, Cash in; not read yet (null), the Wallet page, which reads
// it and asks there (a tap in the first second no longer opens Cash in for a
// locked wallet, only to be refused at the end).
const cashInTap = locked =>
  locked === true ? 'verify' : locked === false ? 'cash-in' : 'wallet';

// Verify ID tapped on another screen lands on the Wallet page: start the
// check when one can be started; otherwise say where it stands (the tile's
// own words, in a notice that closes itself) rather than nothing.
const verifyOnArrival = (canStart, tile) =>
  canStart ? 'start' : tile?.title ? 'tell' : 'none';

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
  LOCKED_MONEY_LINE,
  LOCKED_CARD_NOTE,
  EMPTY_NOTE,
  LOCKED_EMPTY_NOTE,
  walletLocked,
  balanceLabel,
  lockedMoneyLine,
  lockedCardNote,
  emptyTransactionsNote,
  actionLook,
  cashInTap,
  verifyOnArrival,
  isLockedRefusal,
  lockedAlert,
  verifyParams,
};
