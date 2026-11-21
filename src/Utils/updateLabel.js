// What the landing screen shows after the version: which self-update the
// app is running. Pure (no RN imports) so it runs under `node --test`;
// src/Utils/selfUpdate.js feeds it from the update library.
//
// Nothing for the code the APK came with; otherwise the commit the update
// was built from, so it can be matched against the repository.
function updateLabel({ isEmbeddedLaunch, commit, updateId } = {}) {
  if (isEmbeddedLaunch) {
    return '';
  }
  if (commit && /^[0-9a-f]{7,40}$/i.test(String(commit))) {
    return String(commit).slice(0, 7).toLowerCase();
  }
  return updateId ? String(updateId).slice(0, 8) : '';
}

module.exports = { updateLabel };
