import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../updateNotice.js';
const { READY_SHOWN_MS, updateNotice } = mod;

test('nothing is said when nothing is going on', () => {
  assert.equal(
    updateNotice({ isDownloading: false, isUpdatePending: false }),
    null,
  );
  assert.equal(updateNotice({}), null);
  assert.equal(updateNotice(undefined), null);
  assert.equal(updateNotice(null), null);
  // looking for an update is not worth a line: most starts find none
  assert.equal(updateNotice({ isChecking: true }), null);
});

test('an update that is still on its way is said to be downloading', () => {
  assert.deepEqual(updateNotice({ isDownloading: true }), {
    kind: 'downloading',
    text: 'Downloading an update…',
  });
});

test('an update that arrived tells the person how to get it', () => {
  const said = updateNotice({ isUpdatePending: true });
  assert.equal(said.kind, 'ready');
  assert.match(said.text, /^Update ready\./);
  // the app takes an update only when it is started fresh
  assert.match(said.text, /Close the app and open it again/);
});

test('ready wins over downloading', () => {
  assert.equal(
    updateNotice({ isDownloading: true, isUpdatePending: true }).kind,
    'ready',
  );
});

test('"Update ready" stays long enough to read, and then goes', () => {
  assert.ok(
    READY_SHOWN_MS >= 5000 && READY_SHOWN_MS <= 15000,
    `${READY_SHOWN_MS}`,
  );
});
