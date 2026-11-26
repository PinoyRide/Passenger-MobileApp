import React, { useEffect, useState } from 'react';
import AlertBox from '@/Components/AlertBox/AlertBox';
import useAutoClose, {
  NOTICE_AUTO_CLOSE_MS,
  NOTICE_READ_MS,
} from '@/Hooks/useAutoClose';
import { boxState } from '@/Utils/alertShape';
import { closeAlert, subscribeAlerts } from '@/Utils/appAlert';

// Draws what Utils/appAlert.js is asked to show, one box at a time. Mounted
// once, inside the theme (PaperProvider), so the boxes take the light or the
// dark look. The same file in both apps (sharedUi.test.mjs).

// the boxes answered with a button: closing them is not a dismissal
const answered = new WeakSet();

// A dismissal (the back button, or nobody answering: useAutoClose, once read
// for a notice, after three minutes for a question) runs the asker's
// onDismiss, as the platform's dialog does; a button runs its own answer
// instead.
const close = box => {
  closeAlert(box.id);
  setTimeout(() => {
    if (!answered.has(box) && box.onDismiss) {
      box.onDismiss();
    }
  }, 0);
};

const Shown = ({ box }) => {
  // a notice once read, a question after three minutes (Utils/alertShape.js
  // boxState); an asked box is never busy, but the rule is the AlertBox's
  const { autoClose } = boxState(box);
  useAutoClose(
    autoClose !== 'never',
    () => close(box),
    autoClose === 'read' ? NOTICE_READ_MS : NOTICE_AUTO_CLOSE_MS,
  );
  const answer = run => () => {
    answered.add(box);
    if (run) {
      run();
    }
  };
  return (
    <AlertBox
      visible
      setVisible={visible => {
        if (!visible) {
          close(box);
        }
      }}
      title={box.title}
      message={box.message}
      icon={box.icon}
      note={box.note}
      points={box.points}
      errorText={box.errorText}
      dismissable={box.dismissable}
      confirmText={box.confirmText}
      onConfirm={answer(box.onConfirm)}
      secondaryText={box.secondaryText}
      onSecondary={answer(box.onSecondary)}
    />
  );
};

const AlertHost = () => {
  const [box, setBox] = useState(null);
  useEffect(() => subscribeAlerts(setBox), []);
  return box ? <Shown key={box.id} box={box} /> : null;
};

export default AlertHost;
