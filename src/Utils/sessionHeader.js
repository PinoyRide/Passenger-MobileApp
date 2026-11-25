// The passenger's sign-in token, as the header every request to the API
// carries. customers/login answers it (sessionToken); since 2026-11-25
// (security finding F-1) the API answers a request naming a passenger only
// with that passenger's token, and signs the app out without it.
//
// Read from the store when the request is sent, not when the screen last
// drew: the first requests after signing in (the push token, Home) go out
// before the screen that sent them has drawn again.
// (Pure: the store is passed in, so node --test can check it.)
const { newTokenFrom, swapRequestHeaders } = require('./sessionSwap');

const SESSION_HEADER = 'X-Customer-Session';

// With the token, the app says it takes a new one behind the scenes
// (Utils/sessionSwap.js).
function sessionHeaderFrom(state) {
  const token = state?.user?.sessionToken;
  return token ? { [SESSION_HEADER]: token, ...swapRequestHeaders() } : {};
}

// The header for the signed-in passenger, or none. The store is required
// here, when a request is sent, so this file does not pull the store into
// every module that imports it.
function sessionHeader() {
  const { store } = require('@/Redux/store');
  return sessionHeaderFrom(store.getState());
}

// Stores a token the API handed out with this answer (any answer, also an
// error or one a newer request made stale), with no screen. The store keeps
// it only over an older one (userSlice swapSessionToken), so every request
// sent after this carries it; requests already on their way carry the old
// one, which the API still takes for a while.
function takeNewToken(headers) {
  const swapped = newTokenFrom(headers);
  if (!swapped) {
    return;
  }
  const { store } = require('@/Redux/store');
  const { swapSessionToken } = require('@/Redux/Slices/userSlice');
  store.dispatch(swapSessionToken(swapped));
}

module.exports = {
  SESSION_HEADER,
  sessionHeaderFrom,
  sessionHeader,
  takeNewToken,
};
