// Space under content pinned to the bottom of the screen, so Android's
// navigation bar never covers it. Pure (no RN imports) so it runs under
// `node --test`.
//
// The app draws behind the system bars (edge to edge), so a screen that is
// not inside Container (which pads for them) must leave the room itself.
// `inset` is the bottom safe-area inset (useSafeAreaInsets().bottom): the
// navigation bar's height when the app draws behind it, 0 when it does not.
// The screen keeps its own spacing (`base`) unless the bar needs more, and
// then the content ends `clearance` above the bar.

const CLEARANCE = 16;

function bottomSpace(inset, base = 20, clearance = CLEARANCE) {
  const bar = Number.isFinite(inset) && inset > 0 ? inset : 0;
  return Math.max(base, bar > 0 ? bar + clearance : 0);
}

module.exports = { bottomSpace, CLEARANCE };
