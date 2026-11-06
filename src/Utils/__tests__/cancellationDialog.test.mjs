import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freeCancellationPreview,
  cancellationConfirmationCopy,
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
