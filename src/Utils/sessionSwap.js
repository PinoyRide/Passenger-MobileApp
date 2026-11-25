// The silent sign-in token swap (security finding F-2 part 2; the owner,
// 2026-11-25: "I need the behind the scenes"). Shared: the same file in both
// apps (sharedUi.test.mjs).
//
// Every request says the app takes a new token (SWAP_HEADER). About once a
// month the API answers one request with a new token (X-New-Session) and when
// it was made (X-New-Session-At, Unix ms). The app stores it with no screen,
// and only over an older one: two answers coming back out of order (the
// foreground and the Rider's background location, or a swap made again after
// a lost answer) always leave the newest token stored. The old token keeps
// working for a while on the server, so calls already in flight are answered;
// an answer that was lost is made good by the server on a later call. Nobody
// is signed out by a swap.
//
// Pure (no React Native), so node --test checks it.

const SWAP_HEADER = 'X-Session-Swap';
const NEW_TOKEN_HEADER = 'x-new-session';
const NEW_TOKEN_AT_HEADER = 'x-new-session-at';

// The header every request carries.
const swapRequestHeaders = () => ({ [SWAP_HEADER]: '1' });

// One response header, from axios' headers (a plain object with lower-case
// names, or AxiosHeaders with get()).
const headerOf = (headers, name) => {
  if (!headers) {
    return null;
  }
  const value =
    typeof headers.get === 'function'
      ? headers.get(name)
      : headers[name] ?? headers[name.toLowerCase()];
  return value == null ? null : String(value);
};

// { token, at } handed out with this answer, or null.
const newTokenFrom = headers => {
  const token = headerOf(headers, NEW_TOKEN_HEADER);
  const at = Number(headerOf(headers, NEW_TOKEN_AT_HEADER));
  if (!token || !token.trim() || !Number.isFinite(at) || at <= 0) {
    return null;
  }
  return { token: token.trim(), at };
};

// Whether a token made at `at` replaces the stored one (made at storedAt, or
// unknown: the one from signing in, older than any swap).
const isNewer = (at, storedAt) =>
  Number.isFinite(at) && (!Number.isFinite(storedAt) || at > storedAt);

module.exports = {
  SWAP_HEADER,
  NEW_TOKEN_HEADER,
  NEW_TOKEN_AT_HEADER,
  swapRequestHeaders,
  newTokenFrom,
  isNewer,
};
