import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../dropoffEta.js';
const {
  getDropoffEtaText,
  formatArrivalClock,
  keepDropoffEta,
  IN_TRANSIT,
} = mod;

test('shows In transit when there is no eta yet', () => {
  assert.equal(getDropoffEtaText(null), IN_TRANSIT);
});

test('shows In transit for a pickup-leg payload', () => {
  assert.equal(
    getDropoffEtaText({ state: 'en_route', eta_minutes: 8, leg: 'pickup' }),
    IN_TRANSIT,
  );
});

test('keeps showing a drop-off eta with no stale timeout', () => {
  const noon = new Date(2026, 10, 5, 12, 0, 0, 0).getTime();
  const oldReceived = noon - 10 * 60 * 1000;
  assert.equal(
    getDropoffEtaText(
      { state: 'en_route', eta_minutes: 8, leg: 'dropoff' },
      oldReceived,
      noon,
    ),
    'In transit · ETA 12:08 PM',
  );
});

test('formats arrival as 12-hour clock', () => {
  const noon = new Date(2026, 10, 5, 12, 0, 0, 0).getTime();
  assert.equal(formatArrivalClock(15, noon), '12:15 PM');
  assert.equal(formatArrivalClock(1, noon), '12:01 PM');
  const morning = new Date(2026, 10, 5, 9, 50, 0, 0).getTime();
  assert.equal(formatArrivalClock(20, morning), '10:10 AM');
});

test('appends arrival clock while en route', () => {
  const noon = new Date(2026, 10, 5, 12, 0, 0, 0).getTime();
  assert.equal(
    getDropoffEtaText(
      { state: 'en_route', eta_minutes: 15, leg: 'dropoff' },
      noon,
      noon,
    ),
    'In transit · ETA 12:15 PM',
  );
});

test('appends Arriving now when close', () => {
  const now = Date.now();
  assert.equal(
    getDropoffEtaText(
      { state: 'arriving_now', eta_minutes: 0, leg: 'dropoff' },
      now,
      now,
    ),
    'In transit · Arriving now',
  );
  assert.equal(
    getDropoffEtaText(
      { state: 'en_route', eta_minutes: 0.4, leg: 'dropoff' },
      now,
      now,
    ),
    'In transit · Arriving now',
  );
});

test('uses pretty minutes as a clock when eta_minutes is missing', () => {
  const noon = new Date(2026, 10, 5, 12, 0, 0, 0).getTime();
  assert.equal(
    getDropoffEtaText(
      { state: 'en_route', pretty: 'Arriving in 12 mins', leg: 'dropoff' },
      noon,
      noon,
    ),
    'In transit · ETA 12:12 PM',
  );
});

test('keepDropoffEta keeps previous when poll is empty or pickup', () => {
  const prev = { state: 'en_route', eta_minutes: 10, leg: 'dropoff' };
  assert.equal(keepDropoffEta(prev, null), prev);
  assert.equal(keepDropoffEta(prev, undefined), prev);
  assert.equal(
    keepDropoffEta(prev, { state: 'en_route', eta_minutes: 3, leg: 'pickup' }),
    prev,
  );
});

test('keepDropoffEta replaces with a newer valid drop-off eta', () => {
  const prev = { state: 'en_route', eta_minutes: 10, leg: 'dropoff' };
  const next = { state: 'en_route', eta_minutes: 6, leg: 'dropoff' };
  assert.equal(keepDropoffEta(prev, next), next);
  assert.equal(keepDropoffEta(null, next), next);
});
