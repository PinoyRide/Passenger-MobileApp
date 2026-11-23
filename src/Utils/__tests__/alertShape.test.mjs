import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../alertShape.js';

const { alertShape } = mod;
const noop = () => {};

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
