// Detects the first launch after an app update, so stale login state
// from the previous version can be cleared. Pure (no RN imports) so it
// runs under `node --test`.
const LAST_RUN_VERSION_KEY = 'lastRunAppVersion';

function isUpdatedSinceLastRun(lastRunVersion, currentVersion) {
  if (!lastRunVersion || !currentVersion) {
    return false;
  }
  return String(lastRunVersion) !== String(currentVersion);
}

module.exports = { LAST_RUN_VERSION_KEY, isUpdatedSinceLastRun };
