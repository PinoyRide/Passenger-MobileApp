// What a place search does with what was typed, and what its answer means
// (A-328: the Rider's Home Address search uses the Passenger's search). Pure
// (no RN imports) so it runs under `node --test`; Hooks/usePlaceSearch.js
// runs it. The same file in both apps (sharedUi.test.mjs).
//
// Every ask is a paid Google call (CLAUDE.md "Paid services"): an app can
// wait for a few letters before asking (the Rider's home address: 3; the
// Passenger's places: 1) and stop asking after a number of calls (the
// Rider: 10 a visit; the Passenger: no limit).

// How long after the last key the search asks.
const PAUSE_MS = 300;

// What to do with the words typed:
// 'clear'  nothing typed: no list, nothing asked
// 'wait'   fewer letters than the app asks for: nothing asked yet
// 'capped' the calls of this visit are used up: nothing asked any more
// 'ask'    ask for suggestions (after PAUSE_MS)
function planSearch({
  typed,
  minLength = 1,
  callsMade = 0,
  maxCalls = Infinity,
} = {}) {
  const words = String(typed ?? '').trim();
  if (!words) {
    return 'clear';
  }
  if (words.length < minLength) {
    return 'wait';
  }
  if (callsMade >= maxCalls) {
    return 'capped';
  }
  return 'ask';
}

// What an answer means for the list: 'failed' (no answer: no signal, the
// server, a refusal), 'empty' (an answer with no place in it) or 'results'.
// A failed request is not "no places found" (A-328 B4): the person is told
// to check their signal, not to try other words.
function resultStatus({ failed, list } = {}) {
  if (failed) {
    return 'failed';
  }
  return Array.isArray(list) && list.length > 0 ? 'results' : 'empty';
}

module.exports = { PAUSE_MS, planSearch, resultStatus };
