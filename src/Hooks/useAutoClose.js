import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { startOnScreenTimer } from '@/Utils/onScreenTimer';

// A box nobody answers closes by itself: after `ms` on screen `close` runs.
// It closes the box the way its own button would, without starting what the
// button may also open (a trip's details, for one). The same file in both
// apps (sharedUi.test.mjs).
//   NOTICE_AUTO_CLOSE_MS  a box with a choice or an action (the owner,
//                         2026-11-23: "the confirm box stays if i do nothing,
//                         should auto confirm in 3 minutes when user does not
//                         confirm")
//   NOTICE_READ_MS        a notice, one button that only closes it: once it
//                         is read (the owner, the same day: "if i do nothing
//                         this always stays in my screen"). Utils/alertShape.js
//                         (isNotice) tells the two apart; AlertBox and
//                         AlertHost apply it.
// A busy box (a spinner on its filled button) never closes by itself while
// busy: it waits for its answer, or for its 15-second error state
// (Utils/alertShape.js boxState, Utils/busyTimeout.js).
// Only time on screen counts (Utils/onScreenTimer.js): a box raised while the
// app is minimized waits for the person to come back (QA NTF-10).
export const NOTICE_AUTO_CLOSE_MS = 3 * 60 * 1000;
export const NOTICE_READ_MS = 10 * 1000;

const useAutoClose = (visible, close, ms = NOTICE_AUTO_CLOSE_MS) => {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    return startOnScreenTimer(() => closeRef.current?.(), ms, AppState);
  }, [visible, ms]);
};

export default useAutoClose;
