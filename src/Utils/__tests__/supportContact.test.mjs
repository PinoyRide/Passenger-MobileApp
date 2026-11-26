import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mod from '../supportContact.js';

const {
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_PLACEHOLDER,
  EMERGENCY_LINE,
  supportEmail,
  supportMailUri,
  supportAlert,
} = mod;

// Q-WALLET-TEXT (the owner, A-217, 2026-11-26): the team picks the support
// contact shown; the owner set the public support email (A-285 item 9).
// Settings > Help & support used to say "coming soon" in both apps.

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');

test('the public support email is set (A-285): the box shows it with a button to write, never the placeholder', () => {
  assert.equal(SUPPORT_EMAIL, 'contact.pinoyride@gmail.com');
  assert.equal(supportEmail(), 'contact.pinoyride@gmail.com');
  const opened = [];
  const [title, message, buttons] = supportAlert(uri => opened.push(uri));
  assert.equal(title, 'Help & support');
  assert.equal(
    message,
    `Email us at contact.pinoyride@gmail.com.\n\n${EMERGENCY_LINE}`,
  );
  assert.doesNotMatch(message, /to be announced/);
  assert.equal(buttons.length, 2);
  buttons[1].onPress();
  assert.deepEqual(opened, [
    'mailto:contact.pinoyride@gmail.com?subject=Pinoy%20Ride%20support',
  ]);
});

test('with no usable support email the box falls back to the placeholder, 911 first in line after it', () => {
  const [title, message, buttons] = supportAlert(() => {}, '');
  assert.equal(title, 'Help & support');
  assert.equal(
    message,
    `Email us at ${SUPPORT_EMAIL_PLACEHOLDER}.\n\n${EMERGENCY_LINE}`,
  );
  assert.match(message, /\[support email to be announced\]/);
  assert.match(message, /call 911 now/);
  // a notice: nothing to tap but OK, so it closes itself once read
  assert.equal(buttons, undefined);
  assert.doesNotMatch(message, /coming soon/i);
});

test('once the owner fills it in, the address is shown with a button to write', () => {
  const opened = [];
  const [title, message, buttons] = supportAlert(
    uri => opened.push(uri),
    ' help@example.com ',
  );
  assert.equal(title, 'Help & support');
  assert.equal(message, `Email us at help@example.com.\n\n${EMERGENCY_LINE}`);
  assert.equal(buttons.length, 2);
  assert.deepEqual(
    buttons.map(b => [b.text, b.style]),
    [
      ['Close', 'cancel'],
      ['Write an email', undefined],
    ],
  );
  buttons[1].onPress();
  assert.deepEqual(opened, [
    'mailto:help@example.com?subject=Pinoy%20Ride%20support',
  ]);
});

test('a phone with no mail app: the button neither throws nor rejects', async () => {
  const [, , throwing] = supportAlert(() => {
    throw new Error('no app');
  }, 'help@example.com');
  assert.doesNotThrow(() => throwing[1].onPress());
  const [, , rejecting] = supportAlert(
    () => Promise.reject(new Error('no app')),
    'help@example.com',
  );
  assert.doesNotThrow(() => rejecting[1].onPress());
  // an unhandled rejection would fail this file
  await new Promise(done => setTimeout(done, 10));
});

test('something that is not an address counts as not given', () => {
  for (const value of [
    '',
    '   ',
    null,
    'support',
    'a@b',
    'a b@c.d',
  ]) {
    assert.equal(supportEmail(value), '', String(value));
    assert.equal(supportAlert(() => {}, value).length, 2, String(value));
  }
  // nothing passed means the set address, not "not given"
  assert.equal(supportEmail(undefined), SUPPORT_EMAIL);
  assert.equal(supportAlert(() => {}, undefined).length, 3);
  assert.equal(
    supportEmail('support@pinoyride.example'),
    'support@pinoyride.example',
  );
  assert.equal(
    supportMailUri('a@b.c'),
    'mailto:a@b.c?subject=Pinoy%20Ride%20support',
  );
});

test('Settings > Help & support shows the support contact, not "coming soon"', () => {
  const settings = read('src/Screens/SettingsScreen/SettingsScreen.js');
  assert.match(
    settings,
    /import \{ supportAlert \} from '@\/Utils\/supportContact';/,
  );
  assert.match(
    settings,
    /const showSupport = \(\) => appAlert\(\.\.\.supportAlert\(Linking\.openURL\)\);/,
  );
  assert.match(
    settings,
    /title="Help & support"[\s\S]{0,80}onPress=\{showSupport\}/,
  );
  assert.doesNotMatch(settings, /helpComingSoon|in the app is coming soon/);
});
