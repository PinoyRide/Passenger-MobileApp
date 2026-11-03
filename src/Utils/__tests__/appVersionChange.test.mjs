import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../appVersionChange.js';
const { isUpdatedSinceLastRun } = mod;

test('fresh install (no stored version) is not an update', () => {
  assert.equal(isUpdatedSinceLastRun(null, '1.1.1'), false);
  assert.equal(isUpdatedSinceLastRun('', '1.1.1'), false);
});
test('same version is not an update', () => {
  assert.equal(isUpdatedSinceLastRun('1.1.1', '1.1.1'), false);
});
test('different version is an update', () => {
  assert.equal(isUpdatedSinceLastRun('1.1.0', '1.1.1'), true);
  assert.equal(isUpdatedSinceLastRun('1.0.9', '1.0.10'), true);
});
test('missing current version is not an update', () => {
  assert.equal(isUpdatedSinceLastRun('1.1.0', ''), false);
});
