// Edge padding (dp) for fitting the rider and their destination into the part
// of the passenger's map that is actually visible: below the header buttons
// and above whatever covers the bottom (the trip sheet, and the ETA banner
// that floats over it while the rider is on the way).
//
// The trip sheet can cover most of the screen. Asking the map for more
// padding than it has height puts the rider off-screen, so when room is short
// the paddings give way (the top first) and a window is always left to fit into.

// Clears the profile, Emergency and Follow driver buttons.
const TOP = 200;
// Still clears the Emergency button (the vehicle marker must not sit under it).
const MIN_TOP = 145;
// Half a marker plus breathing room above the covered area.
const MARGIN = 50;
const SIDE = 60;
// Smallest window worth fitting two points into.
const MIN_WINDOW = 110;

function overviewPadding(mapHeight, coveredBottom) {
  const height = Number(mapHeight) > 0 ? Number(mapHeight) : 0;
  const covered = Math.max(0, Number(coveredBottom) || 0);
  if (!height) {
    // Not laid out yet: the usual paddings.
    return { top: TOP, right: SIDE, bottom: covered + MARGIN, left: SIDE };
  }
  let bottom = covered + MARGIN;
  const top = Math.max(MIN_TOP, Math.min(TOP, height - bottom - MIN_WINDOW));
  if (height - top - bottom < MIN_WINDOW) {
    bottom = Math.max(0, height - top - MIN_WINDOW);
  }
  return { top, right: SIDE, bottom, left: SIDE };
}

module.exports = { overviewPadding };
