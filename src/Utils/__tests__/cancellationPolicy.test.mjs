import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANCEL_FREE_BODY,
  CANCEL_GRACE_MINUTES,
  cancelPenaltyPercent,
  cancelWithPenaltyBody,
  passengerCancellationNotice,
} from '../cancellationPolicy.js';

const NO_NUMBER_NOTICE_END =
  'incurs a cancellation penalty based on the estimated fare and counts as 1 violation.';
const NO_NUMBER_BODY_END =
  'A cancellation penalty based on the estimated fare will be applied.';

test('grace is 5 minutes from rider acceptance for passenger copy', () => {
  const notice = passengerCancellationNotice(20);
  assert.equal(CANCEL_GRACE_MINUTES, 5);
  assert.match(notice, /5 minutes after a rider accepts/);
  assert.match(notice, /even inside the 2-hour window/);
});

test('notice no longer claims every within-2-hours cancel is charged', () => {
  const notice = passengerCancellationNotice(20);
  const oldClaim = /Cancellations made within 2 hours but more than 30 minutes/;
  assert.doesNotMatch(notice, oldClaim);
  assert.match(notice, /no rider has accepted yet/);
  assert.match(notice, /pickup is 2 or more hours away/);
  assert.match(notice, /rider is a no-show 30 minutes after pickup/);
});

test('notice renders the backend passenger percent', () => {
  const notice = passengerCancellationNotice(20);
  assert.match(notice, /20% penalty of the estimated fare/);
  assert.doesNotMatch(notice, /10%/);
  assert.match(passengerCancellationNotice('20'), /20% penalty/);
});

test('penalty body explains grace passed and renders backend percent', () => {
  const body = cancelWithPenaltyBody(20);
  assert.match(body, /5-minute free-cancel grace/);
  assert.match(body, /20% of the estimated fare/);
  assert.doesNotMatch(body, /10%/);
});

test('missing, null or invalid percent gives no-number wording', () => {
  for (const bad of [undefined, null, '', 'abc', NaN, -5, Infinity, {}]) {
    const notice = passengerCancellationNotice(bad);
    const body = cancelWithPenaltyBody(bad);
    assert.ok(notice.endsWith(NO_NUMBER_NOTICE_END), `notice for ${bad}`);
    assert.ok(body.endsWith(NO_NUMBER_BODY_END), `body for ${bad}`);
    assert.doesNotMatch(notice, /%/);
    assert.doesNotMatch(body, /%/);
  }
  assert.ok(passengerCancellationNotice().endsWith(NO_NUMBER_NOTICE_END));
  assert.ok(cancelWithPenaltyBody().endsWith(NO_NUMBER_BODY_END));
});

test('percent helper validates and trims decimals', () => {
  assert.equal(cancelPenaltyPercent(20), '20');
  assert.equal(cancelPenaltyPercent('12.5'), '12.5');
  assert.equal(cancelPenaltyPercent(15.0), '15');
  assert.equal(cancelPenaltyPercent(0), '0');
  assert.equal(cancelPenaltyPercent(null), null);
  assert.equal(cancelPenaltyPercent('x'), null);
  assert.equal(cancelPenaltyPercent(101), null);
});

test('free body stays simple', () => {
  assert.match(CANCEL_FREE_BODY, /No cancellation penalty applies/);
});
