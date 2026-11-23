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
// options: the platform's cancelable and onDismiss, the AlertBox's icon and
// note, and safe. Pure (no RN imports) so it runs under `node --test`. The
// same file in both apps (sharedUi.test.mjs).

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

module.exports = { alertShape };
