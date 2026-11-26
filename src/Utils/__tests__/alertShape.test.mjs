import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mod from '../alertShape.js';

const { alertShape, isNotice, boxState } = mod;
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
    /useAutoClose\(\s*visible && state\.autoClose === 'read',/,
  );
  const host = read('src/Components/AlertBox/AlertHost.js');
  assert.match(host, /const \{ autoClose \} = boxState\(box\);/);
  assert.match(
    host,
    /useAutoClose\(\s*autoClose !== 'never',[\s\S]*autoClose === 'read' \? NOTICE_READ_MS : NOTICE_AUTO_CLOSE_MS/,
  );
  const timing = read('src/Hooks/useAutoClose.js');
  assert.match(timing, /NOTICE_READ_MS = 10 \* 1000;/);
  assert.match(timing, /NOTICE_AUTO_CLOSE_MS = 3 \* 60 \* 1000;/);
});

// --- The AlertBox's states (A-184 piece b, design/A-184/SPEC.md section 4) ---

const plain = {
  onConfirm: noop,
  secondaryText: 'Keep booking',
  dismissable: true,
};

test('with none of the new props the box works as it always did', () => {
  assert.deepEqual(boxState(plain), {
    spinner: false,
    confirmEnabled: true,
    closeOnAnswer: true,
    back: 'close',
    autoClose: 'ask',
  });
  assert.equal(boxState({}).autoClose, 'read');
  assert.equal(boxState({ dismissable: false }).back, 'none');
  // an asked box: the shape appAlert makes
  assert.deepEqual(
    boxState(
      alertShape('Log Out', '', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', onPress: noop },
      ]),
    ),
    boxState(plain),
  );
});

test('busy: a spinner on the filled button, which cannot be tapped; the quiet answer still can', () => {
  const state = boxState({ ...plain, busy: true });
  assert.equal(state.spinner, true);
  assert.equal(state.confirmEnabled, false);
  // the quiet button is the safe answer ("Keep booking"): Back does it too
  assert.equal(state.back, 'secondary');
  // no quiet answer: Back closes it, unless it must not
  assert.equal(boxState({ onConfirm: noop, busy: true }).back, 'close');
  assert.equal(
    boxState({ ...plain, busy: true, dismissable: false }).back,
    'none',
  );
});

test('a busy box never closes by itself, a notice-shaped one neither', () => {
  assert.equal(boxState({ ...plain, busy: true }).autoClose, 'never');
  assert.equal(boxState({ busy: true }).autoClose, 'never');
  assert.equal(
    boxState({ ...plain, busy: true, keepOpen: true }).autoClose,
    'never',
  );
  // the spell over, the usual rule again
  assert.equal(
    boxState({ ...plain, busy: false, keepOpen: true }).autoClose,
    'ask',
  );
});

test('keepOpen: a tap runs the answer and leaves the box to its caller', () => {
  assert.equal(boxState({ ...plain, keepOpen: true }).closeOnAnswer, false);
  assert.equal(boxState({ ...plain, keepOpen: true }).confirmEnabled, true);
  assert.equal(boxState(plain).closeOnAnswer, true);
});

test('field: a required one left blank holds the filled button', () => {
  const field = value => ({
    label: 'What happened?',
    value,
    onChangeText: noop,
    required: true,
  });
  assert.equal(boxState({ ...plain, field: field('') }).confirmEnabled, false);
  assert.equal(
    boxState({ ...plain, field: field('   ') }).confirmEnabled,
    false,
  );
  assert.equal(
    boxState({ ...plain, field: field(undefined) }).confirmEnabled,
    false,
  );
  assert.equal(
    boxState({ ...plain, field: field('Flat tyre') }).confirmEnabled,
    true,
  );
  // not required: blank is an answer
  assert.equal(
    boxState({ ...plain, field: { value: '', onChangeText: noop } })
      .confirmEnabled,
    true,
  );
  // busy wins over a filled field
  assert.equal(
    boxState({ ...plain, busy: true, field: field('Flat tyre') })
      .confirmEnabled,
    false,
  );
});

test('points: the tips carry over from appAlert, the empty ones left out', () => {
  const box = alertShape(
    'Before you start',
    'PayCools will check your ID.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Continue', onPress: noop },
    ],
    {
      points: [
        {
          icon: 'white-balance-sunny',
          text: 'Bright place, no shine on your ID',
        },
        null,
        { icon: 'cellphone' },
        { text: 'Hold your phone steady' },
      ],
      note: 'Tries left today: 2',
    },
  );
  assert.deepEqual(box.points, [
    { icon: 'white-balance-sunny', text: 'Bright place, no shine on your ID' },
    { icon: undefined, text: 'Hold your phone steady' },
  ]);
  assert.equal(box.note, 'Tries left today: 2');
  assert.equal(alertShape('Saved', '').points, undefined);
  // the tips keep the box a question: it waits three minutes
  assert.equal(boxState(box).autoClose, 'ask');
});

test('errorText: the red line carries over from appAlert', () => {
  assert.equal(
    alertShape('Cancel booking', "We couldn't check the fee.", [], {
      errorText: 'No connection. Check your signal and try again.',
    }).errorText,
    'No connection. Check your signal and try again.',
  );
  assert.equal(alertShape('Saved', '').errorText, undefined);
});

test('an asked box cannot change, so busy, keepOpen and field are not taken from appAlert', () => {
  const box = alertShape('Sending', '', [{ text: 'OK', onPress: noop }], {
    busy: true,
    keepOpen: true,
    field: { required: true, value: '' },
  });
  assert.equal(box.busy, undefined);
  assert.equal(box.keepOpen, undefined);
  assert.equal(box.field, undefined);
});

test('the AlertBox draws the states with its own look', () => {
  const source = read('src/Components/AlertBox/AlertBox.js');
  const style = name => {
    const at = source.indexOf(`    ${name}: {`);
    assert.ok(at > 0, `style ${name} not found`);
    return source.slice(at, source.indexOf('},', at));
  };
  // the note lifted to 12 px, the quiet button to 48 dp (SPEC sections 4-5)
  assert.match(style('note'), /fontSize: 12,/);
  assert.match(style('secondaryButton'), /height: 48,/);
  assert.match(style('confirmButton'), /height: 48,/);
  // the spinner in the words' colour on gold; the error line red
  assert.match(source, /<ActivityIndicator\s+color=\{look\.onAccent\}/);
  assert.match(style('error'), /color: look\.red,/);
  assert.match(style('fieldBox'), /borderColor: look\.fieldEdge,/);
  assert.match(style('overlay'), /backgroundColor: look\.scrim,/);
  // the 15-second error state, and Back as the state says
  assert.match(source, /startBusyTimeout\(/);
  assert.match(source, /onRequestClose=\{handleBack\}/);
  // the title, message and points scroll; the buttons stay outside
  const scrollEnd = source.indexOf('</ScrollView>');
  assert.ok(source.indexOf('styles.pointText') < scrollEnd);
  assert.ok(source.indexOf('onPress={handleConfirm}') > scrollEnd);
});

test('every colour in the AlertBox comes from the look (modern.js)', () => {
  const source = read('src/Components/AlertBox/AlertBox.js');
  const fixed = source
    .split('\n')
    .filter(line => /(color|Color)\s*[:=]\s*\{?\s*['"]/.test(line))
    // the drop shadow is black in both looks; it is not a colour of words or fills
    .filter(line => !/shadowColor: '#000'/.test(line));
  assert.deepEqual(fixed, []);
});
