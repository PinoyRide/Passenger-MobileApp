import { useEffect, useRef } from 'react';

// A notice nobody answers closes by itself (the owner, 2026-11-23: "the
// confirm box stays if i do nothing, should auto confirm in 3 minutes when
// user does not confirm"). After `ms` on screen `close` runs: it closes the
// box the way its own button would, without starting what the button may
// also open (a trip's details, for one). The same file in both apps
// (sharedUi.test.mjs).
export const NOTICE_AUTO_CLOSE_MS = 3 * 60 * 1000;

const useAutoClose = (visible, close, ms = NOTICE_AUTO_CLOSE_MS) => {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const timer = setTimeout(() => closeRef.current?.(), ms);
    return () => clearTimeout(timer);
  }, [visible, ms]);
};

export default useAutoClose;
