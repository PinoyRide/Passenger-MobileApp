import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../updateLogout.js';
const { shouldCallLogout, logoutErrorText, FALLBACK_ERROR } = mod;

test('skips logout when nobody is logged in', () => {
  assert.equal(shouldCallLogout(null), false);
  assert.equal(shouldCallLogout(undefined), false);
  assert.equal(shouldCallLogout({}), false);
});

test('calls logout when a passenger is logged in', () => {
  assert.equal(shouldCallLogout({ id: 42 }), true);
});

test('shows the real server error when there is one', () => {
  assert.equal(logoutErrorText('Customer Id is required'), 'Customer Id is required');
});

test('falls back to the generic message otherwise', () => {
  assert.equal(logoutErrorText(null), FALLBACK_ERROR);
  assert.equal(logoutErrorText(''), FALLBACK_ERROR);
  assert.equal(logoutErrorText({}), FALLBACK_ERROR);
});
