import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mod from '../codeBoxes.js';

const { typedCode, boxesOf, activeBox } = mod;

// QA SIN-08: on the code screen a Backspace from a hardware keyboard (adb's
// KEYCODE_DEL) cleared the last box and then stopped: "1 1 1 1 1" stayed.
// Each box was its own field and stepping back needed `onKeyPress`, which
// Android sends only for the on-screen keyboard. The code is now typed into
// one field: a Backspace there removes the last digit, whatever keyboard it
// came from.

// What Android does to the one field on a Backspace: the last character goes.
const backspace = text => text.slice(0, -1);

test('Backspace removes the digits one after another, down to none', () => {
  let field = '111111';
  const seen = [];
  for (let press = 0; press < 7; press++) {
    field = typedCode(backspace(field), 6);
    seen.push(boxesOf(field, 6).join(' ').trim());
  }
  assert.deepEqual(seen, [
    '1 1 1 1 1',
    '1 1 1 1',
    '1 1 1',
    '1 1',
    '1',
    '',
    '',
  ]);
});

test('the next digit goes after the last one typed', () => {
  assert.equal(activeBox('', 6), 0);
  assert.equal(activeBox('123', 6), 3);
  assert.equal(activeBox('123456', 6), 5);
  assert.deepEqual(boxesOf('123', 6), ['1', '2', '3', '', '', '']);
});

test('the field keeps digits only, at most the code length', () => {
  assert.equal(typedCode('123 456', 6), '123456');
  assert.equal(typedCode('1234567', 6), '123456');
  assert.equal(typedCode('000000', 6), '000000');
  assert.equal(typedCode(undefined, 6), '');
});

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const source = readFileSync(
  join(app, 'src/Components/OTP/OTPInput.js'),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

test('the code boxes are one field, with no step back on a key press', () => {
  assert.equal(source.match(/<TextInput\b/g)?.length, 1);
  assert.doesNotMatch(source, /onKeyPress/);
  assert.match(source, /typedCode\(/);
});
