// Which backend this app talks to: Develop or Sandbox (the owner, A-342 /
// A-345: Sandbox is an exact copy of Develop, with its own API). The app
// decides it from its own package name, which is native: one self-update pack
// serves both APKs, and the APK it is installed from chooses the server.
//
// - A package ending in ".sandbox" (com.pinoyride.customer.sandbox,
//   com.pinoyride.rider.sandbox, built by APK/release-sandbox.sh) talks to the
//   Sandbox API.
// - ".dev", the Google Play names and anything else keep today's address, the
//   DEV_URL of Constants.js, unchanged.
// - A name that cannot be read (node, an error) means Develop: it fails to
//   Develop, never to Sandbox, so a Develop app can never talk to Sandbox.
//
// Only the API base changes. Photos, cash-out logos and the like come back
// from the API as whole addresses; the app key and the Google keys are the
// same on both (the owner: same keys); the self-update address is native (the
// APK's manifest), set by the Sandbox build.
//
// The same file in both apps (sharedUi.test.mjs). Pure apart from
// appEnvironment(), which requires react-native-device-info only when called,
// so node --test can load this file.

const DEVELOP = 'develop';
const SANDBOX = 'sandbox';
const SANDBOX_SUFFIX = '.sandbox';
const SANDBOX_API = 'https://pinoyride-api-sandbox.onrender.com/api/';
const LABELS = { [DEVELOP]: 'Develop', [SANDBOX]: 'Sandbox' };

// SANDBOX only for a package name that is a string ending in ".sandbox"
function environmentFor(bundleId) {
  return typeof bundleId === 'string' && bundleId.endsWith(SANDBOX_SUFFIX)
    ? SANDBOX
    : DEVELOP;
}

// The API base for an environment: Sandbox's, or the given Develop one
// (Constants.js's DEV_URL, which stays the one committed address)
function apiBaseFor(environment, developUrl) {
  return environment === SANDBOX ? SANDBOX_API : developUrl;
}

// The word on the first screen's version line: "v2.1.33 · Sandbox · e953727"
function environmentLabel(environment) {
  return LABELS[environment] ?? LABELS[DEVELOP];
}

// read once: the package name does not change while the app runs
let cached = null;

function appEnvironment() {
  if (cached !== null) {
    return cached;
  }
  try {
    const loaded = require('react-native-device-info');
    const DeviceInfo = loaded?.default ?? loaded;
    cached = environmentFor(DeviceInfo.getBundleId());
  } catch (error) {
    cached = DEVELOP;
  }
  return cached;
}

module.exports = {
  DEVELOP,
  SANDBOX,
  SANDBOX_API,
  environmentFor,
  apiBaseFor,
  environmentLabel,
  appEnvironment,
};
