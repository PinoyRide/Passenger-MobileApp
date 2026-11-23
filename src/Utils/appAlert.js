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

// AlertHost, when a box is answered or closed: the next one, if any
export const closeAlert = () => {
  shown = waiting.shift() || null;
  publish();
};

const appAlert = (title, message, buttons, options) => {
  const box = alertShape(title, message, buttons, options);
  if (!box || hosts.size === 0) {
    Alert.alert(title, message, buttons, options);
    return;
  }
  lastId += 1;
  box.id = lastId;
  if (shown) {
    waiting.push(box);
    return;
  }
  shown = box;
  publish();
};

export default appAlert;
