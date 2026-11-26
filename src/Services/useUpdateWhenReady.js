import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { canRestart, restartApp } from '@/Utils/appRestart';
import {
  TICK_MS,
  afterRestart,
  mayRestartInto,
  shouldCheck,
  shouldRestart,
} from '@/Utils/updateWhenReady';

// Takes an update while the app is open, without waiting for the person to
// restart it (the owner, 2026-11-22). Every TICK_MS: ask the server when it is
// time (every two minutes while the app is on screen, and at once when it
// comes back to the screen; the start itself has just asked), download what
// it offers, and restart into it as soon as the app is on screen and `busy()`
// names nothing a restart would cut off (a booking under way or being placed,
// a booking request, a payment, something half done; see updateWhenReady.js).
// The restart is the native one (appRestart.js), so the update starts as at
// any start, with the loading screen and its fallback. An update that did not
// start after such a restart is never restarted into again. The same file in
// both apps; each app passes its own busy().
const PENDING = 'pinoyride.update.restartedInto';
const REFUSED = 'pinoyride.update.refused';

const readList = async key => {
  try {
    return JSON.parse((await AsyncStorage.getItem(key)) || '[]');
  } catch (e) {
    return [];
  }
};

export default function useUpdateWhenReady(busy) {
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled || !canRestart()) {
      return undefined;
    }
    const state = {
      ready: null, // the id of a downloaded update to restart into
      checking: false,
      // expo-updates asked the server as the app started (CHECK_ON_LAUNCH
      // ALWAYS): the next ask is due CHECK_EVERY_MS from now
      lastCheckedAt: Date.now(),
      refused: [],
      restarting: false,
    };

    // Did the last restart into an update start it? Remember the ones that did not.
    const settle = (async () => {
      try {
        const pending = await AsyncStorage.getItem(PENDING);
        const next = afterRestart({
          pending,
          running: Updates.updateId,
          refused: await readList(REFUSED),
        });
        state.refused = next.refused;
        await AsyncStorage.setItem(REFUSED, JSON.stringify(next.refused));
        await AsyncStorage.removeItem(PENDING);
      } catch (e) {
        // storage unreadable: no restart this session rather than a loop
        state.restarting = true;
      }
    })();

    const tryRestart = async () => {
      if (state.restarting || !state.ready) {
        return;
      }
      const go = shouldRestart({
        ready: mayRestartInto(state.ready, state.refused),
        active: AppState.currentState === 'active',
        busy: busyRef.current(),
      });
      if (!go) {
        return;
      }
      state.restarting = true;
      try {
        await AsyncStorage.setItem(PENDING, state.ready);
      } catch (e) {
        state.restarting = false;
        return; // without the note a failing update could restart forever
      }
      restartApp();
    };

    const tick = async (force = false) => {
      await settle;
      const now = Date.now();
      if (
        shouldCheck({
          active: AppState.currentState === 'active',
          ready: Boolean(state.ready),
          checking: state.checking,
          lastCheckedAt: state.lastCheckedAt,
          now,
          force,
        })
      ) {
        state.checking = true;
        state.lastCheckedAt = now;
        try {
          const found = await Updates.checkForUpdateAsync();
          const id = found.manifest?.id;
          if (found.isAvailable && mayRestartInto(id, state.refused)) {
            await Updates.fetchUpdateAsync();
            state.ready = id;
          }
        } catch (e) {
          // offline, or the server could not be reached: asked again later
        } finally {
          state.checking = false;
        }
      }
      await tryRestart();
    };

    const timer = setInterval(() => tick(false), TICK_MS);
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') {
        tick(true);
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
}
