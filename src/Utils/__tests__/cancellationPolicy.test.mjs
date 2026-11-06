import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANCEL_GRACE_MINUTES,
  PASSENGER_CANCELLATION_NOTICE,
  CANCEL_WITH_PENALTY_BODY,
  CANCEL_FREE_BODY,
} from '../cancellationPolicy.js';

test('grace is 5 minutes from rider acceptance for passenger copy', () => {
  assert.equal(CANCEL_GRACE_MINUTES, 5);
  assert.match(PASSENGER_CANCELLATION_NOTICE, /5 minutes after a rider accepts/);
  assert.match(PASSENGER_CANCELLATION_NOTICE, /even inside the 2-hour window/);
});

test('notice no longer claims every within-2-hours cancel is charged', () => {
  assert.doesNotMatch(
    PASSENGER_CANCELLATION_NOTICE,
    /Cancellations made within 2 hours but more than 30 minutes/,
  );
  assert.match(PASSENGER_CANCELLATION_NOTICE, /10% penalty/);
  assert.match(PASSENGER_CANCELLATION_NOTICE, /no rider has accepted yet/);
  assert.match(PASSENGER_CANCELLATION_NOTICE, /pickup is 2 or more hours away/);
  assert.match(PASSENGER_CANCELLATION_NOTICE, /rider is a no-show 30 minutes after pickup/);
});

test('penalty body explains grace passed and 2-hour window', () => {
  assert.match(CANCEL_WITH_PENALTY_BODY, /5-minute free-cancel grace/);
  assert.match(CANCEL_WITH_PENALTY_BODY, /10% of the estimated fare/);
});

test('free body stays simple', () => {
  assert.match(CANCEL_FREE_BODY, /No cancellation penalty applies/);
});
