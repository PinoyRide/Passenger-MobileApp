// The line of boxes Utils/appAlert.js draws: one shown, the rest waiting in
// the order asked. Pure (no RN imports) so it runs under `node --test`. The
// same file in both apps (sharedUi.test.mjs).
//
// A box asked with `priority` does not wait behind the others: it is what
// lasts only a moment, a booking offered to the rider for about 20 s (the
// owner, 2026-11-25: offers queued behind a "Booking Cancelled" box ran out
// unseen and counted as missed). It goes in front of the box shown, which
// goes back to the head of the line and shows again after it; behind a
// priority box already shown, it is the next one shown.

const createAlertQueue = onChange => {
  let shown = null;
  const waiting = [];

  const show = box => {
    shown = box;
    onChange(shown);
  };

  // where a priority box waits: after the priority boxes already waiting,
  // before every other one
  const frontOfLine = () => {
    const at = waiting.findIndex(box => !box.priority);
    return at === -1 ? waiting.length : at;
  };

  return {
    current: () => shown,
    waiting: () => waiting.slice(),

    add(box) {
      if (!shown) {
        show(box);
        return;
      }
      if (!box.priority) {
        waiting.push(box);
        return;
      }
      if (!shown.priority) {
        waiting.unshift(shown);
        show(box);
        return;
      }
      waiting.splice(frontOfLine(), 0, box);
    },

    // the box shown (`id`) was answered or closed: the next one, if any.
    // Nothing when that box is no longer the one shown (taken back, or put
    // back in line by a priority box): closing it again must not close the
    // next one.
    close(id) {
      if (id !== undefined && shown?.id !== id) {
        return;
      }
      show(waiting.shift() || null);
    },

    // takes back the boxes asked with this key, shown or waiting
    dismiss(key) {
      if (!key) {
        return;
      }
      for (let i = waiting.length - 1; i >= 0; i -= 1) {
        if (waiting[i].key === key) {
          waiting.splice(i, 1);
        }
      }
      if (shown && shown.key === key) {
        show(waiting.shift() || null);
      }
    },
  };
};

module.exports = { createAlertQueue };
