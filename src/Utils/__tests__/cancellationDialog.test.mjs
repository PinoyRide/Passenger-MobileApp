import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANCEL_PREVIEW_FAILED_BODY,
  cancelDialogState,
  cancelPreviewOutcome,
  cancelRoute,
  cancelYesAction,
  instantCancelPreview,
  isAdvanceBooking,
  updateStatusCancelOutcome,
} from '../cancellationDialog.js';

const NO_PENALTY = /no cancellation penalty/i;

test('free preview opens exactly one plain Cancel Booking? dialog', () => {
  const d = cancelDialogState({ penaltyApplies: false });
  assert.equal(d.mode, 'free');
  assert.equal(d.title, 'Cancel Booking?');
  assert.match(d.body, NO_PENALTY);
  assert.equal(d.showAmount, false);
  assert.equal(d.yesLabel, 'Yes');
});

test('penalty preview opens the penalty dialog straight away with 20%', () => {
  const d = cancelDialogState({ penaltyApplies: true, penaltyPercent: 20 });
  assert.equal(d.mode, 'penalty');
  assert.equal(d.title, 'Cancel Booking with Penalty?');
  assert.match(d.body, /20% of the estimated fare/);
  assert.doesNotMatch(d.body, NO_PENALTY);
  assert.equal(d.showAmount, true);
});

test('loading state never shows the no-penalty text and blocks Yes/No', () => {
  for (const penaltyApplies of [false, true, undefined]) {
    const d = cancelDialogState({ checking: true, penaltyApplies });
    assert.equal(d.mode, 'loading');
    assert.doesNotMatch(d.title + d.body, NO_PENALTY);
    assert.equal(d.showAmount, false);
    assert.equal(d.buttonsDisabled, true);
  }
});

test('preview failure uses neutral wording with Retry and Close', () => {
  const d = cancelDialogState({ failed: true, penaltyApplies: false });
  assert.equal(d.mode, 'error');
  assert.equal(d.body, CANCEL_PREVIEW_FAILED_BODY);
  assert.doesNotMatch(d.title + d.body, NO_PENALTY);
  assert.equal(d.yesLabel, 'Retry');
  assert.equal(d.noLabel, 'Close');
});

test('advance check reads is_advance, booking_label and scheduled pickup', () => {
  assert.equal(isAdvanceBooking({ is_advance: true }), true);
  assert.equal(isAdvanceBooking({ is_advance: '1' }), true);
  assert.equal(isAdvanceBooking({ booking_label: 'Advance Booking' }), true);
  const pickup = { scheduled_pickup_at: '2026-11-09T10:00:00Z' };
  assert.equal(isAdvanceBooking(pickup), true);
  assert.equal(isAdvanceBooking({ scheduled_at: '2026-11-09T10:00' }), true);
  assert.equal(isAdvanceBooking({ id: 1 }, new Date()), true);
  assert.equal(isAdvanceBooking({ id: 1, is_advance: false }), false);
  assert.equal(isAdvanceBooking({ id: 1, is_advance: '0' }), false);
  assert.equal(isAdvanceBooking(null), false);
});

test('advance cancel routes to cancel_advance; instant to update_status', () => {
  assert.equal(cancelRoute({ id: 7, is_advance: true }), 'cancel_advance');
  assert.equal(cancelRoute({ id: 7, is_advance: false }), 'update_status');
  assert.equal(cancelRoute({ id: 7 }, null), 'update_status');
  // advance with no id can't be previewed: error, never a free cancel
  assert.equal(cancelRoute({ is_advance: true }), 'error');
  assert.equal(cancelRoute({}, null, 9), 'update_status');
  assert.equal(cancelRoute({ is_advance: true }, null, 9), 'cancel_advance');
});

test('advance + 404 or any preview failure -> error state, no free cancel', () => {
  for (const error of [
    'Request failed with status code 404',
    'Network Error',
    'boom',
  ]) {
    assert.equal(cancelPreviewOutcome({ error }).kind, 'error');
  }
  // malformed success must not be read as "free"
  assert.equal(cancelPreviewOutcome({ response: {} }).kind, 'error');
  assert.equal(cancelPreviewOutcome({ response: { data: {} } }).kind, 'error');
  assert.equal(cancelPreviewOutcome({}).kind, 'error');
});

test('preview outcomes: ready, replaced and server-confirmed instant', () => {
  const data = { booking_id: 3, penalty_applies: true, penalty_amount: 15.22 };
  const ok = cancelPreviewOutcome({ response: { code: 200, data } });
  assert.equal(ok.kind, 'ready');
  assert.deepEqual(ok.preview, data);
  const gone = { error: 'This booking can no longer be cancelled' };
  assert.equal(cancelPreviewOutcome(gone).kind, 'replaced');
  const instant = cancelPreviewOutcome({ error: 'Not an advance booking' });
  assert.equal(instant.kind, 'instant');
});

test('Yes action: busy ignored, error retries, penalty confirms, free cancels', () => {
  assert.equal(cancelYesAction({ penalty_applies: true }, true), 'none');
  assert.equal(cancelYesAction(null, false), 'none');
  assert.equal(cancelYesAction({ failed: true }, false), 'retry');
  assert.equal(cancelYesAction({ penalty_applies: true }, false), 'penalty');
  assert.equal(cancelYesAction({ penalty_applies: false }, false), 'free');
  assert.equal(cancelYesAction(instantCancelPreview(5), false), 'free');
});

test('instant confirm preview is free and carries the booking id', () => {
  assert.deepEqual(instantCancelPreview(42), {
    booking_id: 42,
    penalty_applies: false,
    instant: true,
  });
});

test('update_status 409 use_cancel_advance switches to preview, never success', () => {
  const msg =
    'A cancellation fee applies. Use booking/cancel_advance with preview first.';
  assert.equal(updateStatusCancelOutcome({ error: msg }), 'use_cancel_advance');
  const data = { error_code: 'use_cancel_advance' };
  const res409 = { response: { code: 409, data } };
  assert.equal(updateStatusCancelOutcome(res409), 'use_cancel_advance');
  // a 409 must not be mistaken for the old 404 fallback or a free cancel
  assert.equal(cancelPreviewOutcome({ error: msg }).kind, 'error');
  assert.equal(updateStatusCancelOutcome({ error: 'Server error' }), 'error');
  const ok = { response: { code: 200, data: {} } };
  assert.equal(updateStatusCancelOutcome(ok), 'cancelled');
});
