import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import usePostRequest from '@/Services/Api';
import { Constants } from '@/Utils';
import {
  cashOutOutcome,
  nextResultCheck,
  resultPageSaysIt,
  watchResultPushes,
} from '@/Utils/cashOut';

// Where a cash-out stands, for its result page: 'processing' until the API
// says it was paid out ('completed') or failed with the amount back in the
// wallet ('failed'). Asks cash_out/check_status/ on the schedule in
// cashOut.js (nextResultCheck), and at once when the app comes back to the
// front (timers do not run while it is away) or the cash-out's notification
// arrives (cashOutPushOnPage). The same file in both apps.
//   reference   the cash-out's reference id (PRCO...); nothing is asked without one
//   firstStatus what the cash-out request answered ('processing' or 'completed')
//   enabled     false on result pages that are not a cash-out
export default function useCashOutResult(reference, firstStatus, enabled = true) {
  const [outcome, setOutcome] = useState(() =>
    cashOutOutcome({ status: firstStatus }),
  );
  const statusRequest = usePostRequest();
  const openedAt = useRef(Date.now());
  const asking = useRef(false);
  const settled = outcome !== 'processing';
  const outcomeRef = useRef(outcome);
  outcomeRef.current = outcome;

  // In a ref, so the timer and the listener always call the latest one
  const askRef = useRef(async () => {});
  askRef.current = async () => {
    if (!enabled || !reference || asking.current) {
      return;
    }
    asking.current = true;
    let answer;
    try {
      answer = await statusRequest.makePostRequest(
        Constants.ENDPOINT.CASH_OUT_STATUS,
        { reference_id: reference },
        {},
        'json',
      );
    } finally {
      asking.current = false;
    }
    const next = cashOutOutcome(answer?.response?.data);
    if (next !== 'processing') {
      setOutcome(next);
    }
  };

  useEffect(() => {
    if (!enabled || !reference || settled) {
      return undefined;
    }
    let stopped = false;
    let timer = null;
    const schedule = () => {
      const wait = nextResultCheck(Date.now() - openedAt.current);
      if (wait === null) {
        return;
      }
      timer = setTimeout(async () => {
        await askRef.current();
        if (!stopped) {
          schedule();
        }
      }, wait);
    };
    schedule();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        askRef.current();
      }
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, [enabled, reference, settled]);

  // The cash-out's notification, in the open app, while this page is on
  // screen: check at once; the push handler shows its box unless the page
  // still says the result itself (CSO-19, 2026-11-25).
  useEffect(() => {
    if (!enabled || !reference) {
      return undefined;
    }
    return watchResultPushes({
      reference,
      checkNow: () => {
        if (outcomeRef.current === 'processing') {
          askRef.current();
        }
      },
      saysIt: () =>
        resultPageSaysIt(outcomeRef.current, Date.now() - openedAt.current),
    });
  }, [enabled, reference]);

  return outcome;
}
