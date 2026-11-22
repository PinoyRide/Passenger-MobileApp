import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { signedOutReason, signedOutNotice } = require('../signedOut.js');

test('older routes: 401 with signed_out in the data', () => {
  const body = { status: 'error', code: 401, data: { signed_out: true, reason: 'deleted' } };
  assert.equal(signedOutReason(401, body), 'deleted');
  assert.equal(signedOutReason(401, { ...body, data: { signed_out: true, reason: 'signed_out' } }), 'signed_out');
});
test('newer routes: 401 with signedOut in the data', () => {
  assert.equal(signedOutReason(401, { success: false, data: { signedOut: true, reason: 'signed_out' } }), 'signed_out');
});
test('an unknown reason still signs out', () => {
  assert.equal(signedOutReason(401, { data: { signed_out: true, reason: 'other' } }), 'signed_out');
  assert.equal(signedOutReason(401, { data: { signed_out: true } }), 'signed_out');
});
test('any other answer is not a sign-out', () => {
  assert.equal(signedOutReason(401, { message: 'Unauthorized' }), null);
  assert.equal(signedOutReason(401, { data: { signed_out: false } }), null);
  assert.equal(signedOutReason(404, { data: { signed_out: true } }), null);
  assert.equal(signedOutReason(200, { status: 'success', data: {} }), null);
  assert.equal(signedOutReason(undefined, undefined), null);
});
test('the passenger is told why', () => {
  assert.match(signedOutNotice('deleted').message, /no longer exists/);
  assert.match(signedOutNotice('signed_out').message, /signed out/);
});
