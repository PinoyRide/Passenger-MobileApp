// The passenger's sign-in token, as the header every request to the API
// carries. customers/login answers it (sessionToken); since 2026-11-25
// (security finding F-1) the API answers a request naming a passenger only
// with that passenger's token, and signs the app out without it.
//
// Read from the store when the request is sent, not when the screen last
// drew: the first requests after signing in (the push token, Home) go out
// before the screen that sent them has drawn again.
// (Pure: the store is passed in, so node --test can check it.)
const SESSION_HEADER = 'X-Customer-Session';

function sessionHeaderFrom(state) {
  const token = state?.user?.sessionToken;
  return token ? { [SESSION_HEADER]: token } : {};
}

// The header for the signed-in passenger, or none. The store is required
// here, when a request is sent, so this file does not pull the store into
// every module that imports it.
function sessionHeader() {
  const { store } = require('@/Redux/store');
  return sessionHeaderFrom(store.getState());
}

module.exports = { SESSION_HEADER, sessionHeaderFrom, sessionHeader };
