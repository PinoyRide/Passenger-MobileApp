import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mod from '../alertShape.js';
import timeout from '../busyTimeout.js';

const { alertShape, isNotice, boxState, FIELD_HINT } = mod;
const noop = () => {};
const { BUSY_TIMEOUT_TEXT } = timeout;
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
    errorText: '',
    confirmEnabled: true,
    closeOnConfirm: true,
    back: 'close',
    autoClose: 'ask',
    fieldHint: '',
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
  assert.equal(state.errorText, '');
  // the quiet button is the safe answer ("Keep booking"): Back does it too
  assert.equal(state.back, 'secondary');
  // no quiet answer: Back closes it, unless it must not
  assert.equal(boxState({ onConfirm: noop, busy: true }).back, 'close');
  assert.equal(
    boxState({ ...plain, busy: true, dismissable: false }).back,
    'none',
  );
});

// Code review Q-REVIEW-A184-B finding 1: once timed out, the filled button
// came back while the caller was still busy, and its answer could run twice
// (a second cancel, a second "Send").
test('timed out and still busy: the error line, and the filled button stays held', () => {
  const state = boxState({ ...plain, busy: true, timedOut: true });
  assert.equal(state.spinner, false);
  assert.equal(state.errorText, BUSY_TIMEOUT_TEXT);
  assert.equal(state.confirmEnabled, false);
  // the quiet answer is still the way out
  assert.equal(state.back, 'secondary');
  // the caller's own words win
  assert.equal(
    boxState({
      ...plain,
      busy: true,
      timedOut: true,
      errorText: "We couldn't check the fee.",
    }).errorText,
    "We couldn't check the fee.",
  );
});

test('the time-out words stay once the caller clears busy, and the button comes back', () => {
  const state = boxState({ ...plain, busy: false, timedOut: true });
  assert.equal(state.errorText, BUSY_TIMEOUT_TEXT);
  assert.equal(state.confirmEnabled, true);
  assert.equal(state.spinner, false);
  // a new spell (busy again, the box resets timedOut): the spinner, no words
  const again = boxState({ ...plain, busy: true, timedOut: false });
  assert.equal(again.spinner, true);
  assert.equal(again.errorText, '');
});

test('a busy box never closes by itself, before or after the time-out', () => {
  assert.equal(boxState({ ...plain, busy: true }).autoClose, 'never');
  assert.equal(boxState({ busy: true }).autoClose, 'never');
  // a notice-shaped busy box does not turn back into a notice once timed out
  assert.equal(boxState({ busy: true, timedOut: true }).autoClose, 'never');
  assert.equal(
    boxState({ ...plain, busy: true, keepOpen: true, timedOut: true })
      .autoClose,
    'never',
  );
  // the spell over, the usual rule again
  assert.equal(
    boxState({ ...plain, busy: false, keepOpen: true }).autoClose,
    'ask',
  );
});

test('nobody trapped: a busy box with no way out closes on Back once timed out', () => {
  const stuck = { onConfirm: noop, dismissable: false, busy: true };
  assert.equal(boxState(stuck).back, 'none');
  assert.equal(boxState({ ...stuck, timedOut: true }).back, 'close');
  // the caller takes the time-out itself: it gives the way out
  assert.equal(
    boxState({ ...stuck, timedOut: true, onBusyTimeout: noop }).back,
    'none',
  );
  // a quiet answer is the way out: Back stays as the caller asked
  assert.equal(
    boxState({ ...stuck, secondaryText: 'Keep booking', timedOut: true }).back,
    'none',
  );
  // not busy: not dismissable means what it says
  assert.equal(
    boxState({ ...stuck, busy: false, timedOut: true }).back,
    'none',
  );
});

test('keepOpen holds only the filled answer: the quiet one and Back still close', () => {
  const state = boxState({ ...plain, keepOpen: true });
  assert.equal(state.closeOnConfirm, false);
  assert.equal(state.confirmEnabled, true);
  assert.equal(state.back, 'close');
  assert.equal(boxState(plain).closeOnConfirm, true);
  const source = read('src/Components/AlertBox/AlertBox.js');
  const quiet = source.slice(
    source.indexOf('const handleSecondary'),
    source.indexOf('const handleBack'),
  );
  assert.match(quiet, /setVisible\(false\);/);
  assert.doesNotMatch(quiet, /closeOnConfirm|keepOpen/);
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
  // a held button says why, for as long as the field is blank
  assert.equal(boxState({ ...plain, field: field('') }).fieldHint, FIELD_HINT);
  assert.equal(FIELD_HINT, 'Write what happened to send it');
  assert.equal(
    boxState({ ...plain, field: { ...field(''), hint: 'Type a few words' } })
      .fieldHint,
    'Type a few words',
  );
  assert.equal(boxState({ ...plain, field: field('Flat tyre') }).fieldHint, '');
  assert.equal(
    boxState({ ...plain, field: { value: '', onChangeText: noop } }).fieldHint,
    '',
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
  // the note lifted to 12 px and centred under the buttons
  assert.match(style('note'), /fontSize: 12,/);
  assert.match(style('note'), /textAlign: 'center',/);
  // both buttons 48 dp or more, growing at large text instead of cutting
  // their words (SPEC section 5; the quiet one was 46)
  for (const button of ['confirmButton', 'secondaryButton']) {
    assert.match(style(button), /minHeight: 48,/);
    assert.doesNotMatch(style(button), /\bheight: /);
  }
  // the box: a card, its corner, no shadow (SPEC section 4, C-6)
  assert.match(style('container'), /backgroundColor: look\.card,/);
  assert.match(style('container'), /borderRadius: look\.radiusCard,/);
  assert.doesNotMatch(source, /shadow\w*:|elevation:/);
  // one look in both apps: ink title, inkSoft message, left-aligned
  assert.match(style('title'), /color: look\.ink,/);
  assert.match(style('title'), /textAlign: 'left',/);
  assert.match(style('message'), /color: look\.inkSoft,/);
  assert.match(style('message'), /textAlign: 'left',/);
  assert.match(style('secondaryLabel'), /color: look\.ink,/);
  assert.match(style('iconPatch'), /width: 52,/);
  assert.match(style('iconPatch'), /borderRadius: look\.radiusTile,/);
  // the spinner in the words' colour on gold; the error line red, read out
  // by TalkBack, and never drawn over the words above it
  assert.match(source, /<ActivityIndicator\s+color=\{look\.onAccent\}/);
  assert.match(style('error'), /color: look\.red,/);
  assert.doesNotMatch(style('error'), /margin\w*: -/);
  assert.match(source, /accessibilityLiveRegion="polite"/);
  assert.match(style('fieldBox'), /borderColor: look\.fieldEdge,/);
  assert.match(style('overlay'), /backgroundColor: look\.scrim,/);
  // the 15-second error state, from the caller's own busy; Back as the
  // state says
  assert.match(source, /startBusyTimeout\(/);
  assert.match(source, /boxState\(\{[^}]*\bbusy,[^}]*\btimedOut,/);
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
    .filter(line =>
      /(color|Color)\s*[:=]\s*\{?\s*['"]|#[0-9a-f]{3,8}\b|rgba?\(/i.test(line),
    );
  assert.deepEqual(fixed, []);
});
