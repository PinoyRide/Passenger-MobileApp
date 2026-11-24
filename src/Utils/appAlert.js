import { Alert } from 'react-native';
import { alertShape } from '@/Utils/alertShape';

// Alert.alert, in the app's look: the same arguments, drawn as an AlertBox
// (the owner, 2026-11-23: "Alerts & notifications: one component, three
// shapes"). Utils/alertShape.js decides the shape; Components/AlertBox/
// AlertHost.js, mounted once inside the theme, draws one box at a time, in
// the order asked. A chooser of three or more answers, and a question asked
// while nothing is drawn to show it (a task in the background), stay the
// platform's dialog. The same file in both apps (sharedUi.test.mjs).

let shown = null;
let lastId = 0;
const waiting = [];
const hosts = new Set();

const publish = () => hosts.forEach(host => host(shown));

// AlertHost: hears each box to draw (null when there is none)
export const subscribeAlerts = host => {
  hosts.add(host);
  host(shown);
  return () => {
    hosts.delete(host);
  };
};

// AlertHost, when the box it shows (`id`) is answered or closed: the next
// one, if any. Nothing when that box is no longer the one shown
// (dismissAlert took it back meanwhile): closing it again must not close the
// next one.
export const closeAlert = id => {
  if (id !== undefined && shown?.id !== id) {
    return;
  }
  shown = waiting.shift() || null;
  publish();
};

// Takes back the boxes asked with this options.key, shown or waiting, when
// what they say is no longer so (a booking offered to the rider that has gone
// to another); the next waiting box, if any, is shown.
export const dismissAlert = key => {
  if (!key) {
    return;
  }
  for (let i = waiting.length - 1; i >= 0; i -= 1) {
    if (waiting[i].key === key) {
      waiting.splice(i, 1);
    }
  }
  if (shown && shown.key === key) {
    shown = waiting.shift() || null;
    publish();
  }
};

const appAlert = (title, message, buttons, options) => {
  const box = alertShape(title, message, buttons, options);
  if (!box || hosts.size === 0) {
    Alert.alert(title, message, buttons, options);
    return;
  }
  lastId += 1;
  box.id = lastId;
  // options.key: what dismissAlert takes it back by
  box.key = options?.key;
  if (shown) {
    waiting.push(box);
    return;
  }
  shown = box;
  publish();
};

export default appAlert;
