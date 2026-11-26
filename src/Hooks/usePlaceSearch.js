import { useCallback, useEffect, useRef, useState } from 'react';
import { sessionFor, suggestionsFrom } from '@/Utils/placeSession';
import { PAUSE_MS, planSearch, resultStatus } from '@/Utils/placeSearch';

// A place search through our API (places/*), as one Google session
// (Utils/placeSession.js): the suggestions while typing, then the one place
// picked looked up alone. Taken out of the Passenger's Add Saved Place for the
// Rider's Home Address (A-328). The same file in both apps
// (sharedUi.test.mjs).
//
// The app hands it the two requests, because the apps ask differently (the
// Passenger's useApiRequest GET, the Rider's Services/placeRequest.js):
//   suggest(typed, token)   places/autocomplete -> { data, failed, stale? }
//   details(placeId, token) places/details      -> { data, failed }
// `stale: true` means the app's own client dropped the answer for a newer one.
// The latest functions are kept, so a request may change with the phone's
// position without restarting the search.
//
// What was typed is asked PAUSE_MS after the last key, from `minLength`
// letters on, at most `maxCalls` times while the screen is open
// (Utils/placeSearch.js). `status`:
//   'idle'      nothing typed
//   'wait'      fewer letters than minLength
//   'searching' asking (the last list stays until the answer)
//   'results' | 'empty' | 'failed'   the answer (failed: no answer at all)
//   'capped'    the calls are used up; the last list stays
export default function usePlaceSearch({
  suggest,
  details,
  minLength = 1,
  maxCalls = Infinity,
} = {}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState('idle');

  const requestsRef = useRef({ suggest, details });
  requestsRef.current = { suggest, details };
  const sessionRef = useRef(null);
  const timerRef = useRef(null);
  // every key and every clear counts up: an answer to older words is dropped
  const seqRef = useRef(0);
  const callsRef = useRef(0);
  const pickingRef = useRef(false);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      seqRef.current += 1;
    },
    [],
  );

  const onQuery = useCallback(
    text => {
      setQuery(text);
      clearTimeout(timerRef.current);
      const seq = ++seqRef.current;
      const typed = String(text ?? '').trim();
      const plan = planSearch({
        typed,
        minLength,
        callsMade: callsRef.current,
        maxCalls,
      });
      if (plan === 'clear' || plan === 'wait') {
        setSuggestions([]);
        setStatus(plan === 'clear' ? 'idle' : 'wait');
        return;
      }
      if (plan === 'capped') {
        setStatus('capped');
        return;
      }
      setStatus('searching');
      timerRef.current = setTimeout(async () => {
        callsRef.current += 1;
        sessionRef.current = sessionFor(sessionRef.current, Date.now());
        let answer;
        try {
          answer = await requestsRef.current.suggest(
            typed,
            sessionRef.current.token,
          );
        } catch (e) {
          answer = { data: null, failed: true };
        }
        if (answer?.stale || seq !== seqRef.current) {
          return;
        }
        const failed = !!answer?.failed;
        const list = failed ? [] : suggestionsFrom(answer?.data);
        setSuggestions(list);
        setStatus(resultStatus({ failed, list }));
      }, PAUSE_MS);
    },
    [minLength, maxCalls],
  );

  // Empties the bar and the list; an answer still on its way is dropped.
  const clear = useCallback(() => {
    clearTimeout(timerRef.current);
    seqRef.current += 1;
    setQuery('');
    setSuggestions([]);
    setStatus('idle');
  }, []);

  // Looks the picked suggestion up (one places/details call): the answer, or
  // null while an earlier pick is still on its way (a double tap). The pick
  // ends the Google session: the next search starts a new one.
  const pick = useCallback(async item => {
    if (pickingRef.current) {
      return null;
    }
    pickingRef.current = true;
    const session = sessionRef.current;
    sessionRef.current = null;
    try {
      const answer = await requestsRef.current.details(
        item?.place_id,
        session?.token,
      );
      return { data: answer?.data, failed: !!answer?.failed };
    } catch (e) {
      return { data: null, failed: true };
    } finally {
      pickingRef.current = false;
    }
  }, []);

  return { query, onQuery, clear, status, suggestions, pick };
}
