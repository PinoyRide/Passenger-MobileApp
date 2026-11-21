// What the app says about an update that did not make it into this start.
// Pure (no RN imports) so it runs under `node --test`.
//
// When the app is opened it waits a few seconds for an update (the screen
// with the moving line, android LaunchScreen.kt). An update that takes
// longer keeps downloading while the app is used, and is taken the next
// time the app is started fresh. The person is told so, instead of being
// left to wonder why "Downloading the update" ended on the old version.

// How long "Update ready" stays on the screen.
const READY_SHOWN_MS = 8000;

// `state` is what expo-updates' useUpdates() gives.
function updateNotice(state) {
  if (state?.isUpdatePending) {
    return {
      kind: 'ready',
      text: 'Update ready. Close the app and open it again to use it.',
    };
  }
  if (state?.isDownloading) {
    return { kind: 'downloading', text: 'Downloading an update…' };
  }
  return null;
}

module.exports = { READY_SHOWN_MS, updateNotice };
