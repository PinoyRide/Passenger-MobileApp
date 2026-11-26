// The words on the Update needed screen (A-184, C-4, approved by the owner on
// 2026-11-26; design/A-184/SPEC.md). Plain words, no version number in the
// message: the person needs to know what to do and that they stay signed in
// (true: neither that screen nor the first start after an update logs anyone
// out, CLAUDE.md). The minimum version, when the API names one, goes on a
// small line of its own. It is given here as people count it (v2.1.04, not
// 2.0.103): the screen turns it with displayVersion, as every screen does,
// and nothing in Utils does (displayVersion.test.mjs). Pure (no RN imports)
// so it runs under `node --test`. The same file in both apps
// (sharedUi.test.mjs).

const UPDATE_NEEDED = {
  title: 'Update needed',
  message:
    'A newer version of Pinoy Ride is needed. Tap Update to download it. You stay signed in.',
  button: 'Update',
};

// The version line, or null when the API sent no usable minimum version.
function minimumVersionLine(shownMinimum) {
  if (typeof shownMinimum !== 'string' || !shownMinimum.trim()) {
    return null;
  }
  return `Version v${shownMinimum.trim()} or newer.`;
}

function updateNeededText(shownMinimum) {
  return {
    ...UPDATE_NEEDED,
    versionLine: minimumVersionLine(shownMinimum),
  };
}

module.exports = { UPDATE_NEEDED, updateNeededText, minimumVersionLine };
