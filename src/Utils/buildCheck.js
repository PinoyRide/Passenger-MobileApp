// Asking the backend, as the app opens, whether the build that is installed
// is still accepted. Pure (no RN imports) so it runs under `node --test`.
//
// A change to the app's native part needs a new build, and an installed app
// cannot install one by itself. The backend knows the newest build in the
// download folder, and sends an older install there. Asking on the first
// screen means the person is told at once, signed in or not; before this,
// a signed-out app found out only when the person tried to log in.

// The app must open without the backend: the question is given this long.
const TIMEOUT_MS = 2500;

// The address to ask. `baseUri` ends in "/api/"; `installedVersion` is the
// version of the build that is installed (what Android's App info shows),
// not the version of an update taken since.
function buildCheckAddress(baseUri, app, installedVersion) {
  return `${baseUri}app-updates/${app}/build?version=${encodeURIComponent(
    installedVersion || '',
  )}`;
}

// What the answer means: where to send the person ({ updateLink,
// minimumVersion }, as the "Update Required" screen takes them), or null to
// go on. A trip under way is never interrupted: the app goes on, and asks
// again the next time it opens.
function buildRequired(body, { tripUnderWay = false } = {}) {
  const data = body?.data;
  if (tripUnderWay || !data || data.updateRequired !== true) {
    return null;
  }
  if (typeof data.updateLink !== 'string' || data.updateLink.length === 0) {
    return null; // nowhere to send them: do not shut them out
  }
  return {
    updateLink: data.updateLink,
    minimumVersion: data.minimumVersion,
  };
}

module.exports = { TIMEOUT_MS, buildCheckAddress, buildRequired };
