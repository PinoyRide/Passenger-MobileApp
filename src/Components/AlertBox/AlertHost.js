import React, { useEffect, useState } from 'react';
import AlertBox from '@/Components/AlertBox/AlertBox';
import useAutoClose from '@/Hooks/useAutoClose';
import { closeAlert, subscribeAlerts } from '@/Utils/appAlert';

// Draws what Utils/appAlert.js is asked to show, one box at a time. Mounted
// once, inside the theme (PaperProvider), so the boxes take the light or the
// dark look. The same file in both apps (sharedUi.test.mjs).

// the boxes answered with a button: closing them is not a dismissal
const answered = new WeakSet();

// A dismissal (the back button, or three minutes unanswered: useAutoClose)
// runs the asker's onDismiss, as the platform's dialog does; a button runs
// its own answer instead.
const close = box => {
  closeAlert();
  setTimeout(() => {
    if (!answered.has(box) && box.onDismiss) {
      box.onDismiss();
    }
  }, 0);
};

const Shown = ({ box }) => {
  useAutoClose(true, () => close(box));
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
