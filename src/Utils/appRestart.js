import { NativeModules } from 'react-native';

// The app's own restart (android AppRestart.kt): it stops the app and starts
// it again from cold, like opening it by hand, so a downloaded update is
// applied with the loading screen and its fallback, as at any start. In the
// APKs built for it on (the owner, 2026-11-22); older APKs do not have it, and
// there an update waits for the next start, as before. The same file in both
// apps.
const native = NativeModules.AppRestart;

export const canRestart = () =>
  Boolean(native) && typeof native.restart === 'function';

export const restartApp = () => {
  if (canRestart()) {
    native.restart();
  }
};
