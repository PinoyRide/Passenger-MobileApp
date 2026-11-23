import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mod from '../alertShape.js';

const { alertShape, isNotice } = mod;
const noop = () => {};
const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');

test('a notice with no button gets one: OK, filled', () => {
  const box = alertShape('Location is off', 'Pinoy Ride needs your location.');
  assert.equal(box.title, 'Location is off');
  assert.equal(box.message, 'Pinoy Ride needs your location.');
  assert.equal(box.confirmText, 'OK');
  assert.equal(box.secondaryText, undefined);
  assert.equal(box.dismissable, true);
});

test('one button is the filled one', () => {
  const go = () => 'went';
  const box = alertShape('Saved', '', [{ text: 'Continue', onPress: go }]);
  assert.equal(box.confirmText, 'Continue');
  assert.equal(box.onConfirm, go);
});

test('two buttons: the action is filled, Cancel quiet, wherever Cancel stands', () => {
  const logOut = () => 'out';
  const first = alertShape('Log Out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log Out', style: 'destructive', onPress: logOut },
  ]);
  assert.equal(first.confirmText, 'Log Out');
  assert.equal(first.onConfirm, logOut);
  assert.equal(first.secondaryText, 'Cancel');

  const second = alertShape('Delete', '', [
    { text: 'Delete', onPress: logOut },
    { text: 'Keep', style: 'cancel', onPress: noop },
  ]);
  assert.equal(second.confirmText, 'Delete');
  assert.equal(second.secondaryText, 'Keep');
  assert.equal(second.onSecondary, noop);
});

test('two buttons without a cancel: the last is the answer the platform expects', () => {
  const box = alertShape('Update', '', [
    { text: 'Later' },
    { text: 'Update now' },
  ]);
  assert.equal(box.confirmText, 'Update now');
  assert.equal(box.secondaryText, 'Later');
});

test('safe: the cancel answer is filled and the costly one quiet, with its note', () => {
  const cancelTrip = () => 'cancelled';
  const box = alertShape(
    'Cancel this trip?',
    'It goes to the next nearest rider.',
    [
      { text: 'Keep the trip', style: 'cancel' },
      { text: 'Cancel trip', style: 'destructive', onPress: cancelTrip },
    ],
    { safe: true, note: 'Cancelled trips count in your Cancelled rate.' },
  );
  assert.equal(box.confirmText, 'Keep the trip');
  assert.equal(box.onConfirm, undefined);
  assert.equal(box.secondaryText, 'Cancel trip');
  assert.equal(box.onSecondary, cancelTrip);
  assert.equal(box.note, 'Cancelled trips count in your Cancelled rate.');
});

test('a chooser of three answers stays the platform list', () => {
  assert.equal(
    alertShape('Photo', '', [
      { text: 'Camera' },
      { text: 'Gallery' },
      { text: 'Cancel', style: 'cancel' },
    ]),
    null,
  );
});

test('the options carry over: not dismissable, onDismiss, icon and note', () => {
  const gone = () => 'gone';
  const box = alertShape('Call 911?', 'This calls the emergency hotline.', [], {
    cancelable: false,
    onDismiss: gone,
    icon: 'phone',
    note: 'Only in an emergency.',
  });
  assert.equal(box.dismissable, false);
  assert.equal(box.onDismiss, gone);
  assert.equal(box.icon, 'phone');
  assert.equal(box.note, 'Only in an emergency.');
});

// The owner, 2026-11-23, of "Trip Passed On" and "Booking update": "if i do
// nothing this always stays in my screen".
test('a notice is one button that only closes the box', () => {
  assert.equal(isNotice(alertShape('Location is off', 'Turn it on.')), true);
  assert.equal(isNotice(alertShape('Saved', '', [{ text: 'OK' }])), true);
  // an action on the button, a second answer, or Back must not close it
  assert.equal(
    isNotice(alertShape('Saved', '', [{ text: 'Continue', onPress: noop }])),
    false,
  );
  assert.equal(
    isNotice(
      alertShape('Log Out', '', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', onPress: noop },
      ]),
    ),
    false,
  );
  assert.equal(
    isNotice(alertShape('Wait', '', [], { cancelable: false })),
    false,
  );
  // AlertBox's own props
  assert.equal(isNotice({}), true);
  assert.equal(isNotice({ onConfirm: noop }), false);
  assert.equal(isNotice({ secondaryText: 'Cancel' }), false);
});

test('a notice closes itself once read, a box that asks after 3 minutes', () => {
  assert.match(
    read('src/Components/AlertBox/AlertBox.js'),
    /useAutoClose\(\s*visible &&\s*isNotice\(/,
  );
  assert.match(
    read('src/Components/AlertBox/AlertHost.js'),
    /isNotice\(box\) \? NOTICE_READ_MS : NOTICE_AUTO_CLOSE_MS/,
  );
  const timing = read('src/Hooks/useAutoClose.js');
  assert.match(timing, /NOTICE_READ_MS = 10 \* 1000;/);
  assert.match(timing, /NOTICE_AUTO_CLOSE_MS = 3 \* 60 \* 1000;/);
});
