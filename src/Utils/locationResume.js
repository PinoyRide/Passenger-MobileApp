// When the location watch has to be started again (QA ONL-14, 2026-11-25).
//
// A watch started while the phone's Location is off never runs: the library
// (react-native-geolocation-service) asks Android's settings first, shows
// Google's "Location Accuracy" box, and when it is dismissed reports one
// error and stops there; it never asks Android for positions. Turning
// Location on afterwards does not wake it, so the map kept the default spot
// until the app was swiped away and opened again.
//
// The hook (src/Hooks/useLocation.js) asks this when the app comes back to
// the front or the notification shade closes (where Location is switched on),
// only after its watch has failed. Nothing is polled: one question to the
// phone per return, none while the watch works.
// Same file in both apps. Pure (no RN imports) so it runs under `node --test`.

function shouldResumeWatch({ wanted, failed, permission, servicesEnabled }) {
  if (!wanted || !failed) {
    return false;
  }
  if (permission !== 'granted') {
    // never asks again here: a refused permission is the screen's to explain
    return false;
  }
  // Location still off: starting again would only bring back Google's box.
  return servicesEnabled !== false;
}

module.exports = { shouldResumeWatch };
