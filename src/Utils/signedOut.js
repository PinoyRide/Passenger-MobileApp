// The API's answer when the account a request comes from was signed out by
// Pinoy Ride (Force logout in the Admin Portal) or no longer exists (deleted
// there): status 401 with data.signed_out (riders/... routes) or
// data.signedOut (the newer ones), from any endpoint, as 426 says "update".
// The app then does what Log Out does (Services/signedOutHandler.js).
const REASONS = ['deleted', 'signed_out'];

// 'deleted' or 'signed_out' when the answer says this account is signed out,
// else null. Any other 401 is not this.
const signedOutReason = (status, body) => {
  if (Number(status) !== 401 && Number(body?.code) !== 401) {
    return null;
  }
  const data = body?.data;
  if (!data || (data.signed_out !== true && data.signedOut !== true)) {
    return null;
  }
  return REASONS.includes(data.reason) ? data.reason : 'signed_out';
};

// What the passenger is told, by reason.
const signedOutNotice = reason =>
  reason === 'deleted'
    ? {
        title: 'Account Removed',
        message:
          'This account no longer exists. Please contact Pinoy Ride if you think this is a mistake.',
      }
    : {
        title: 'Signed Out',
        message: 'You have been signed out. Please log in again.',
      };

// One handler, set once when the app starts. Several requests answered
// "signed out" at the same moment run it once.
let handler = null;
let running = false;

const setSignedOutHandler = fn => {
  handler = fn;
};

const signalSignedOut = reason => {
  if (running || typeof handler !== 'function') {
    return;
  }
  running = true;
  Promise.resolve()
    .then(() => handler(reason))
    .catch(() => {})
    .finally(() => {
      running = false;
    });
};

module.exports = {
  signedOutReason,
  signedOutNotice,
  setSignedOutHandler,
  signalSignedOut,
};
