// The identity check (eKYC) as the Passenger Wallet page draws it, from the
// API's `ekyc` object (A-199 contract: { state, reason, triesLeftToday,
// reference }) and the refusals of a start (`data.reason`). The words are the
// app-designer's (design/A-191/SPEC-REVIEW.md §4.2-4.4); the API's own message
// is never shown for a reason we know. EKYC-HOTFIX (A-300), 2026-11-26.
// Pure (no RN imports) so it runs under `node --test`. Passenger only: the
// Rider app shows no identity check.

// The note under "Activate your wallet": that the identity check is optional
// and nothing waits for it (the team's wording O-2, chosen by the owner in
// A-199 and shipped by A-217; walletText.test.mjs).
const ACTIVATE_NOTE =
  'Optional. Check your ID once. Your wallet works either way.';

// A failed or unfinished check's reason code, in plain words (§4.3).
const REASON_WORDS = {
  id_photo: 'Use your real ID card, not a photocopy or a photo on a screen.',
  id_unreadable:
    'Your ID was hard to read. Try a brighter place with no shine.',
  face: "We couldn't see your face clearly. Take off glasses, cap or mask.",
  not_finished: "The check wasn't finished. Go on to the last step next time.",
};
const REASON_FALLBACK = 'Please try again with the tips.';

const reasonWords = reason => REASON_WORDS[reason] || REASON_FALLBACK;

// Whether the wallet counts as active: the API's `active`, or a passed check.
function ekycPassed(wallet) {
  return Boolean(wallet?.active) || wallet?.ekyc?.state === 'passed';
}

// The states a person can start a check from.
const STARTABLE = ['none', 'failed', 'incomplete'];

// The Wallet tile for this wallet answer, or null when there is none to draw:
// no answer yet (loading), or the check passed (the gold card says ACTIVE).
//   kind   none | checking | review | failed | no_tries | blocked
//   icon   MaterialCommunityIcons name
//   title, note   the words
//   canStart      tapping the tile starts a check
//   tryAgain      the "Try again" pill on the right
// An answer without `ekyc` (an older API) is drawn as `none`.
// Whether a start is offered is the server's `canStart` (EKYC-HOTFIX, owner
// A-313): never a timer in the app. A check the server says may be started
// again although it still reads checking or review is drawn as one that did
// not go through, with Try again. An API without `canStart` keeps the rule by
// state.
function ekycTile(wallet) {
  if (!wallet || ekycPassed(wallet)) {
    return null;
  }
  const ekyc = wallet.ekyc || {};
  const state = ekyc.state || 'none';
  const tries = Number.isInteger(ekyc.triesLeftToday)
    ? ekyc.triesLeftToday
    : null;
  const serverSays =
    typeof ekyc.canStart === 'boolean' ? ekyc.canStart : null;

  if ((state === 'checking' || state === 'review') && serverSays === true) {
    return failedTile(ekyc.reason, tries, true);
  }
  if (STARTABLE.includes(state) && tries === 0) {
    return {
      kind: 'no_tries',
      icon: 'clock-outline',
      title: 'No more tries today',
      note: 'You can try again tomorrow. Your wallet works as usual.',
      canStart: false,
      tryAgain: false,
    };
  }
  switch (state) {
    case 'checking':
      return {
        kind: 'checking',
        icon: 'progress-clock',
        title: 'Checking your ID',
        note: 'This takes a few minutes. You can leave this page.',
        canStart: false,
        tryAgain: false,
      };
    case 'review':
      return {
        kind: 'review',
        icon: 'progress-clock',
        title: 'Your ID is being checked',
        note: "We'll tell you here when it's done. No need to try again.",
        canStart: false,
        tryAgain: false,
      };
    case 'failed':
    case 'incomplete':
      return failedTile(ekyc.reason, tries, serverSays !== false);
    case 'blocked':
      return {
        kind: 'blocked',
        icon: 'alert-circle-outline',
        title: "We couldn't confirm your ID here",
        note: 'Please contact support. Your wallet works as usual.',
        canStart: false,
        tryAgain: false,
      };
    default:
      return {
        kind: 'none',
        icon: 'shield-check-outline',
        title: 'Activate your wallet',
        note: ACTIVATE_NOTE,
        canStart: serverSays !== false,
        tryAgain: false,
      };
  }
}

// A check that did not go through: the reason in words, the tries left, and
// Try again when a start is offered.
function failedTile(reason, tries, startable) {
  return {
    kind: 'failed',
    icon: 'alert-circle-outline',
    title: "We couldn't confirm your ID",
    note:
      reasonWords(reason) +
      (tries === null ? '' : ` Tries left today: ${tries}.`),
    canStart: startable,
    tryAgain: startable,
  };
}

// A refused start (§4.4), chosen by `data.reason`: [title, message] for
// appAlert. An unknown or missing reason (no connection, a server fault) shows
// the request's own error words, or a plain fallback.
const REFUSALS = {
  ekyc_attempts_used: [
    'No more tries today',
    "You've used today's tries. You can try again tomorrow. Your wallet works as usual.",
  ],
  ekyc_unavailable: [
    'Not available right now',
    'The ID check is not available right now. Your wallet works as usual.',
  ],
  ekyc_not_started: [
    "Couldn't start the check",
    'Please try again in a moment.',
  ],
  ekyc_contact_support: [
    "We couldn't confirm your ID here",
    'Please contact support. Your wallet works as usual.',
  ],
};

function ekycRefusal(reason, error) {
  return (
    REFUSALS[reason] || [
      'Activate your wallet',
      error ||
        'Identity verification is not available yet. Please try again later.',
    ]
  );
}

const OPEN_FAILED = ["Couldn't open the check", 'Please try again.'];

// The wallet just became active while the page was showing (the check passed
// in the browser, or a review was decided): say so once.
function ekycJustPassed(before, after) {
  return Boolean(before) && !ekycPassed(before) && ekycPassed(after);
}

// While a check is `checking` and the page is on screen, its status is asked
// every 5 s for up to 2 min (§4.2); the server asks PayCools at most every
// 10 s. A status other than `pending` means the check is over: read the
// wallet again.
const STATUS_POLL_MS = 5000;
const STATUS_POLL_FOR_MS = 2 * 60 * 1000;

function ekycCheckIsOver(status) {
  return typeof status === 'string' && status !== '' && status !== 'pending';
}

module.exports = {
  ACTIVATE_NOTE,
  REASON_WORDS,
  REASON_FALLBACK,
  OPEN_FAILED,
  STATUS_POLL_MS,
  STATUS_POLL_FOR_MS,
  ekycPassed,
  ekycTile,
  ekycRefusal,
  ekycJustPassed,
  ekycCheckIsOver,
};
