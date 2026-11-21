import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../updateLabel.js';
const { updateLabel } = mod;

test('the code the APK came with has no label', () => {
  assert.equal(
    updateLabel({ isEmbeddedLaunch: true, commit: 'abcdef1234' }),
    '',
  );
  assert.equal(updateLabel(), '');
});

test('a fetched update is named by the commit it was built from', () => {
  assert.equal(
    updateLabel({ isEmbeddedLaunch: false, commit: 'ABCDEF1234567890' }),
    'abcdef1',
  );
});

test('without a usable commit, the start of the update id is shown', () => {
  const updateId = '0f6e2b6a-1111-2222-3333-444444444444';
  assert.equal(
    updateLabel({ isEmbeddedLaunch: false, commit: '', updateId }),
    '0f6e2b6a',
  );
  assert.equal(
    updateLabel({ isEmbeddedLaunch: false, commit: '<b>x</b>', updateId }),
    '0f6e2b6a',
  );
  assert.equal(
    updateLabel({ isEmbeddedLaunch: false, commit: '<b>x</b>' }),
    '',
  );
});
