// How a platform question (Alert.alert's title, message, buttons, options)
// becomes the app's AlertBox, by the owner's rule (2026-11-23, "Alerts &
// notifications: one component, three shapes"): the filled button carries
// the answer you want chosen by someone who isn't reading.
//   no button      OK, filled
//   one button     that one, filled
//   two buttons    the action filled, Cancel quiet under it: cancelling is
//                  the answer that can be undone. When the action costs
//                  someone else, `safe: true` fills the cancel answer instead
//                  and leaves the action quiet, with a `note` saying what it
//                  leaves behind (a rider cancelling a passenger's trip).
//   three or more  null: a chooser, which stays the platform's list
// options: the platform's cancelable and onDismiss, the AlertBox's icon,
// note, points and errorText, and safe. Pure (no RN imports) so it runs under
// `node --test`. The same file in both apps (sharedUi.test.mjs).
//   points     a list of { icon, text }: short lines with an icon, under the
//              message (A-199's "Before you start" tips). They scroll with
//              the title and message; the buttons stay in view.
//   errorText  a red line under the message: what went wrong
// A box asked through appAlert cannot change once asked, so the AlertBox's
// busy, keepOpen and field are not taken here: a box that waits on work, or
// takes words, is drawn by its own screen with <AlertBox> (boxState below).

// the points worth drawing: an object with words; the icon is optional
const tidyPoints = points =>
  Array.isArray(points)
    ? points
        .filter(point => point && point.text)
        .map(point => ({ icon: point.icon, text: String(point.text) }))
    : undefined;

const alertShape = (title, message, buttons, options) => {
  const answers = Array.isArray(buttons) ? buttons.filter(Boolean) : [];
  if (answers.length > 2) {
    return null;
  }
  const extra = options || {};
  const box = {
    title: title ? String(title) : '',
    message: message ? String(message) : '',
    icon: extra.icon,
    note: extra.note,
    points: tidyPoints(extra.points),
    errorText: extra.errorText ? String(extra.errorText) : undefined,
    dismissable: extra.cancelable !== false,
    onDismiss: extra.onDismiss,
  };
  if (answers.length === 0) {
    return { ...box, confirmText: 'OK' };
  }
  if (answers.length === 1) {
    return {
      ...box,
      confirmText: answers[0].text || 'OK',
      onConfirm: answers[0].onPress,
    };
  }
  // the platform puts the answer it expects last; a 'cancel' answer is quiet
  // wherever it stands
  const cancelAt = answers.findIndex(answer => answer.style === 'cancel');
  let quiet = answers[cancelAt === -1 ? 0 : cancelAt];
  let filled = answers[cancelAt === 1 ? 0 : 1];
  if (extra.safe) {
    [quiet, filled] = [filled, quiet];
  }
  return {
    ...box,
    confirmText: filled.text || 'OK',
    onConfirm: filled.onPress,
    secondaryText: quiet.text || 'Cancel',
    onSecondary: quiet.onPress,
  };
};

// A notice: one button that only closes the box, which Back may close too.
// It closes itself once read (Hooks/useAutoClose, NOTICE_READ_MS). A second
// answer, an action on the button, or a box Back must not close: it waits for
// the person. Takes alertShape's box or AlertBox's own props.
const isNotice = ({ onConfirm, secondaryText, dismissable } = {}) =>
  !onConfirm && !secondaryText && dismissable !== false;

// What an AlertBox drawn with these props does (A-184, design/A-184/SPEC.md
// section 4). Takes AlertBox's own props, or alertShape's box; with none of
// the new ones it is the box as it always was.
//   busy      the filled button shows a spinner and cannot be tapped; the
//             quiet one can, at full strength (it is the safe answer, "Keep
//             booking"), and Back does what it does (nothing, when the box
//             is not dismissable). The box never closes by
//             itself while busy (Utils/busyTimeout.js ends a spell that hangs).
//   keepOpen  a tap runs the answer but leaves the box open: its caller
//             closes it or changes it
//   field     { label, placeholder, value, onChangeText, required }: words
//             typed in the box; a required field left blank holds the filled
//             button
// Returns:
//   spinner         the filled button shows a spinner for its words
//   confirmEnabled  the filled button can be tapped
//   closeOnAnswer   a button closes the box before running its answer
//   back            what Back does: 'secondary' (the quiet answer), 'close'
//                   or 'none'
//   autoClose       'read' (a notice, once read), 'ask' (a question, after
//                   three minutes) or 'never' (Hooks/useAutoClose)
const boxState = (props = {}) => {
  const { busy, keepOpen, field, secondaryText, dismissable } = props;
  const blank =
    Boolean(field && field.required) &&
    String(field.value == null ? '' : field.value).trim() === '';
  let back = dismissable === false ? 'none' : 'close';
  if (busy && secondaryText && back !== 'none') {
    back = 'secondary';
  }
  let autoClose = isNotice(props) ? 'read' : 'ask';
  if (busy) {
    autoClose = 'never';
  }
  return {
    spinner: Boolean(busy),
    confirmEnabled: !busy && !blank,
    closeOnAnswer: !keepOpen,
    back,
    autoClose,
  };
};

module.exports = { alertShape, isNotice, boxState };
