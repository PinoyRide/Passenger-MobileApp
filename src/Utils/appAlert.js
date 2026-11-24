import { Alert } from 'react-native';
import { alertShape } from '@/Utils/alertShape';
import { createAlertQueue } from '@/Utils/alertQueue';

// Alert.alert, in the app's look: the same arguments, drawn as an AlertBox
// (the owner, 2026-11-23: "Alerts & notifications: one component, three
// shapes"). Utils/alertShape.js decides the shape; Components/AlertBox/
// AlertHost.js, mounted once inside the theme, draws one box at a time, in
// the order asked (Utils/alertQueue.js), except a box asked with
// options.priority, which goes in front. A chooser of three or more answers,
// and a question asked while nothing is drawn to show it (a task in the
// background), stay the platform's dialog. The same file in both apps
// (sharedUi.test.mjs).

let lastId = 0;
const hosts = new Set();

const queue = createAlertQueue(shown => hosts.forEach(host => host(shown)));

// AlertHost: hears each box to draw (null when there is none)
export const subscribeAlerts = host => {
  hosts.add(host);
  host(queue.current());
  return () => {
    hosts.delete(host);
  };
};

// AlertHost, when the box it shows (`id`) is answered or closed: the next
// one, if any. Nothing when that box is no longer the one shown
// (dismissAlert took it back meanwhile, or a priority box went in front):
// closing it again must not close the next one.
export const closeAlert = id => queue.close(id);

// Takes back the boxes asked with this options.key, shown or waiting, when
// what they say is no longer so (a booking offered to the rider that has gone
// to another); the next waiting box, if any, is shown.
export const dismissAlert = key => queue.dismiss(key);

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
  // options.priority: shown at once, in front of the box shown (which shows
  // again after it): for what lasts only a moment, a booking offer
  box.priority = options?.priority === true;
  queue.add(box);
};

export default appAlert;
