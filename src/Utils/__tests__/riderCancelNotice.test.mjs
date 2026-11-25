import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mod from '../riderCancelNotice.js';

const { riderCancelReplacement, riderCancelAlert } = mod;

// get_details of a scheduled ride the rider cancelled (QA LAT-16, 000218 ->
// 000219): the old booking is status 4 and names the new one.
const cancelled = {
  id: 218,
  status: 4,
  is_advance: true,
  replaced_by: 219,
  replaced_by_ref_code: '000219',
};

test('a rider cancel that re-pooled the ride names the new booking', () => {
  assert.deepEqual(riderCancelReplacement(cancelled), {
    oldId: 218,
    newId: 219,
    newRefCode: '000219',
  });
  assert.deepEqual(riderCancelReplacement({ ...cancelled, status: '4' }), {
    oldId: 218,
    newId: 219,
    newRefCode: '000219',
  });
  // a history row keeps the number in raw_status
  assert.ok(
    riderCancelReplacement({
      ...cancelled,
      status: 'Cancelled',
      raw_status: 4,
    }),
  );
});

test('a booking the passenger cancelled, one that expired or one still live says nothing', () => {
  assert.equal(riderCancelReplacement({ id: 218, status: 4 }), null);
  assert.equal(
    riderCancelReplacement({ id: 218, status: 4, replaced_by: null }),
    null,
  );
  for (const status of [0, 1, 2, 3, 5]) {
    assert.equal(riderCancelReplacement({ ...cancelled, status }), null);
  }
  assert.equal(riderCancelReplacement(null), null);
  assert.equal(riderCancelAlert({ id: 218, status: 4 }), null);
});

test('the box says the rider cancelled and gives the new reference', () => {
  assert.deepEqual(riderCancelAlert(cancelled), {
    title: 'Booking update',
    message:
      "Your rider cancelled. We're finding you a new rider. New reference: 000219",
    key: 'rider-cancel-218',
  });
  assert.equal(
    riderCancelAlert({ ...cancelled, replaced_by_ref_code: null }).message,
    "Your rider cancelled. We're finding you a new rider.",
  );
  assert.match(
    riderCancelAlert({ ...cancelled, not_set_off: true }).message,
    /^Your rider didn't respond\. We're finding you a new rider\. New reference: 000219$/,
  );
});

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the parked poll tells the passenger instead of dropping the cancel without a word', () => {
  const poll = read('../../Hooks/useParkedAdvanceBookingPoll.js');
  const done = poll.slice(
    poll.indexOf('statusNum === 3 || statusNum === 4'),
    poll.indexOf('updateParkedAdvanceBooking({'),
  );
  assert.match(done, /riderCancelReplacement\(data\)/);
  assert.match(done, /onRiderCancelledRef\.current\?\.\(data\)/);
});

test('Home raises the box through appAlert (drawn on any screen), once per cancel', () => {
  const home = read('../../Screens/HomeScreen/HomeScreen.js');
  const poll = home.slice(
    home.indexOf('useParkedAdvanceBookingPoll({'),
    home.indexOf('const checkActiveBooking = usePostRequest();'),
  );
  assert.match(poll, /onRiderCancelled: data => tellRiderCancelled\(data\)/);
  const tell = home.slice(
    home.indexOf('const tellRiderCancelled'),
    home.indexOf('const replacementHopsRef'),
  );
  assert.match(tell, /riderCancelAlert\(oldBooking\)/);
  assert.match(tell, /isAlertAsked\(box\.key\)/);
  assert.match(
    tell,
    /appAlert\(box\.title, box\.message, \[\{ text: 'OK' \}\]/,
  );
  const follow = home.slice(
    home.indexOf('const followReplacement'),
    home.indexOf('const replacementLookup'),
  );
  assert.match(follow, /tellRiderCancelled\(oldBooking\)/);
  // no longer Home's own box, which is not on screen under Booking Details
  assert.doesNotMatch(follow, /notifyPush\(/);
});
