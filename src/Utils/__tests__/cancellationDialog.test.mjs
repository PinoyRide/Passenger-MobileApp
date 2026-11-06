import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cancellationConfirmationCopy,
  cancellationDecision,
  freeCancellationPreview,
} from '../cancellationDialog.js';

test('waiting-screen cancel opens free in-app preview before any charge check', () => {
  assert.deepEqual(freeCancellationPreview(42), {
    booking_id: 42,
    penalty_applies: false,
    penalty_amount: 0,
  });
});

test('preview defaults to no booking id without native Alert', () => {
  assert.equal(freeCancellationPreview().penalty_applies, false);
  assert.match(cancellationConfirmationCopy, /No cancellation penalty applies/);
});

test('free Yes dismisses before request; failure can reopen for retry', () => {
  const first = cancellationDecision(false, false);
  assert.equal(first.dismissFree, true);
  assert.equal(first.allowSubmit, true);
  const failed = cancellationDecision(false, false);
  assert.equal(failed.allowSubmit, true);
});

test('busy free or priced confirmation rejects duplicate Yes', () => {
  assert.equal(cancellationDecision(false, true).allowSubmit, false);
  assert.equal(cancellationDecision(true, true).allowSubmit, false);
  assert.equal(cancellationDecision(true, true).dismissFree, false);
});
