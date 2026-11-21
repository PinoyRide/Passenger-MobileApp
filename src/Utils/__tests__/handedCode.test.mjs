import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../handedCode.js';
const { handedCode } = mod;

test('where texts go out, the answer carries no code', () => {
  assert.equal(handedCode({ mobileNo: '09171234567', code: null }), null);
  assert.equal(handedCode({ mobileNo: '09171234567' }), null);
  assert.equal(handedCode(null), null);
  assert.equal(handedCode(undefined), null);
});

test('a code handed over is taken as six digits, text or number', () => {
  assert.equal(handedCode({ code: '123456' }), '123456');
  assert.equal(handedCode({ code: 654321 }), '654321');
  assert.equal(handedCode({ code: '000123' }), '000123');
});

test('anything that is not a six-digit code is left alone', () => {
  assert.equal(handedCode({ code: '12345' }), null);
  assert.equal(handedCode({ code: '1234567' }), null);
  assert.equal(handedCode({ code: '12 456' }), null);
  assert.equal(handedCode({ code: 'abcdef' }), null);
  assert.equal(handedCode({ code: '' }), null);
  assert.equal(handedCode({ code: 200 }), null);
});
