import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mod from '../parkedGoesLive.js';

const { parkedGoesLive } = mod;

const heading = {
  id: 501,
  status: 1,
  is_advance: true,
  heading_to_pickup: true,
};

test('a parked advance booking the rider set off for comes back on an idle Home (LAT-13)', () => {
  assert.equal(parkedGoesLive(heading, {}), 'expand');
  assert.equal(
    parkedGoesLive(heading, { activeBooking: null, bookingStatus: 0 }),
    'expand',
  );
  assert.equal(parkedGoesLive({ id: 501, status: '2' }, {}), 'expand');
});

test('a parked booking still scheduled, finished or cancelled stays parked', () => {
  for (const status of [0, 3, 4, 5, '5', null, undefined]) {
    assert.equal(
      parkedGoesLive({ id: 501, status }, {}),
      null,
      `status ${status}`,
    );
  }
  assert.equal(parkedGoesLive(null, {}), null);
  assert.equal(parkedGoesLive({ status: 1 }, {}), null);
});

test('the same booking already on screen only drops its parked copy', () => {
  assert.equal(
    parkedGoesLive(heading, { activeBooking: { id: '501' }, bookingStatus: 1 }),
    'same',
  );
});

test('another live trip on screen is never replaced', () => {
  const instant = { id: 9, is_advance: false };
  for (const bookingStatus of [0, 1, 2]) {
    assert.equal(
      parkedGoesLive(heading, { activeBooking: instant, bookingStatus }),
      null,
    );
  }
  assert.equal(
    parkedGoesLive(heading, {
      activeBooking: { id: 9, is_advance: true },
      bookingStatus: 1,
    }),
    null,
  );
});

test('a different scheduled booking on screen gives way to the trip under way', () => {
  assert.equal(
    parkedGoesLive(heading, {
      activeBooking: { id: 9, is_advance: true },
      bookingStatus: 5,
    }),
    'replace',
  );
});

test('Home acts on it from the parked poll and discovery no longer skips it', () => {
  const home = readFileSync(
    new URL('../../Screens/HomeScreen/HomeScreen.js', import.meta.url),
    'utf8',
  );
  const poll = home.slice(
    home.indexOf('useParkedAdvanceBookingPoll({'),
    home.indexOf('const checkActiveBooking = usePostRequest();'),
  );
  assert.match(poll, /parkedGoesLive\(/);
  assert.match(poll, /unstable_batchedUpdates\(/);
  const discovery = home.slice(home.indexOf('useAdvanceBookingDiscovery({'));
  // the minimized-id skip must let a trip under way through
  assert.match(
    discovery,
    /minimizedAdvanceBookingIds\.includes\(String\(booking\.id\)\) &&\s*!underWay/,
  );
});
