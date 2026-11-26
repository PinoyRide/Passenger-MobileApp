// Room for the keyboard on a form (A-326, the owner 2026-11-26: "the keyboard
// covers the text box, I can't see what I type").
//
// Both apps draw edge to edge, so Android leaves the window full height under
// the keyboard: the Passenger's adjustResize does nothing, and the Rider's
// adjustPan lifts the window only as far as the caret line. A ScrollView does
// not know the keyboard is there, so a field low on the form stays under it
// (or touches Gboard's suggestion bar) and nothing below it can be scrolled up.
// KeyboardScroll (Components/KeyboardScroll) asks these two sums instead.
//
// Every value is in dp on the screen: the keyboard's top is keyboardDidShow's
// endCoordinates.screenY (Gboard's suggestion bar is part of the keyboard), a
// view's top and bottom come from measure() (the app's root view starts at the
// top of the screen, edge to edge).

// the design rule (design/A-326/KEYBOARD-RULE.md, rule 1)
const FIELD_GAP = 16; // a field's error line ends this far above the keyboard
const ERROR_LINE = 20; // the room kept for the error line when none is shown
const TOP_GAP = 8; // a field's label stays this far below the top of the form

// The padding the form's content needs at its end while the keyboard is up, so
// its last field and its button can be scrolled above the keyboard: the part
// of the form the keyboard covers. Nothing when the window shrank for it.
const keyboardPad = ({ viewBottom, keyboardTop }) => {
  if (!Number.isFinite(viewBottom) || !Number.isFinite(keyboardTop)) {
    return 0;
  }
  return Math.max(0, Math.ceil(viewBottom - keyboardTop));
};

// Where to scroll the form so a field's whole block (label, box, error line)
// is in view, or null when it already is (the page does not jump).
//   scrollY                the form's scroll now
//   viewTop, viewBottom    the form's frame
//   keyboardTop            the keyboard's top, or null when it is down
//   blockTop, blockBottom  the field's block now (with the error line's room)
const revealScroll = ({
  scrollY,
  viewTop,
  viewBottom,
  keyboardTop,
  blockTop,
  blockBottom,
  gap = FIELD_GAP,
  topGap = TOP_GAP,
}) => {
  const values = [scrollY, viewTop, viewBottom, blockTop, blockBottom];
  if (!values.every(Number.isFinite)) {
    return null;
  }
  const seenTop = viewTop + topGap;
  const seenBottom =
    (Number.isFinite(keyboardTop)
      ? Math.min(viewBottom, keyboardTop)
      : viewBottom) - gap;
  // taller than what is left (a long address at a large font): its label
  // goes to the top, and the box scrolls inside
  if (blockBottom - blockTop > seenBottom - seenTop) {
    return Math.abs(blockTop - seenTop) < 1
      ? null
      : Math.max(0, scrollY + (blockTop - seenTop));
  }
  if (blockBottom > seenBottom) {
    return Math.max(0, scrollY + (blockBottom - seenBottom));
  }
  if (blockTop < seenTop) {
    return Math.max(0, scrollY - (seenTop - blockTop));
  }
  return null;
};

module.exports = { FIELD_GAP, ERROR_LINE, TOP_GAP, keyboardPad, revealScroll };
