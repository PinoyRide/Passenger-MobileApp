// Self-updates: the app takes new JavaScript and images from the Pinoy Ride
// backend without a new APK.
//
// The update library (expo-updates) does all of it, and none of it here:
// every time the app starts it asks the backend, and when there is an
// update it downloads it and starts from it. It waits for that at most
// EXPO_UPDATES_LAUNCH_WAIT_MS (android/app/src/main/AndroidManifest.xml);
// an update that takes longer is used the next time the app is started.
// It accepts an update only when the backend signed it and it was made for
// this app's version, and goes back to the one before if an update cannot
// start.
//
// The app is never reloaded in place to pick an update up sooner
// (Updates.reloadAsync): after such a reload the library no longer falls back
// from an update that cannot start, and the app would close instead. An open
// app restarts instead, the native way, which starts the update as at any
// start (Services/useUpdateWhenReady.js; APKs from Passenger 2.0.22 and Rider
// 2.0.23).
import * as Updates from 'expo-updates';
import { updateLabel } from './updateLabel';

// Which update is running, for the landing screen ('' for the code the APK
// came with, and in a debug build).
export const runningUpdateLabel = () => {
  if (__DEV__ || !Updates.isEnabled) {
    return '';
  }
  return updateLabel({
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    commit: Updates.manifest?.extra?.commit,
    updateId: Updates.updateId,
  });
};
