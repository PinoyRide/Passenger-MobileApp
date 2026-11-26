import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mod from '../bookingContact.js';

const { contactFrom, noContactText } = mod;

// KI-63 (the owner, 2026-11-25): without Twilio the API made a number up and
// tapping it could ring a stranger. It now answers `available` false.

test('no masked calls: no number, whatever else the answer carries', () => {
  const answer = {
    message: 'Rider contact number is not available',
    data: {
      available: false,
      reason: 'not_set_up',
      proxy_contact_number: null,
      dial_uri: null,
      access_status: 'unavailable',
    },
  };
  assert.equal(contactFrom(answer, null), 'none');
  // even a number beside available false is never shown or dialled
  assert.equal(
    contactFrom(
      { data: { available: false, proxy_contact_number: '+63 917 095 8199' } },
      null,
    ),
    'none',
  );
});

test('a masked number is shown and dialled as the API gives it', () => {
  assert.deepEqual(
    contactFrom(
      {
        data: {
          available: true,
          proxy_contact_number: '+63 999 000 0001',
          dial_uri: 'tel:+639990000001',
        },
      },
      null,
    ),
    { number: '+63 999 000 0001', dialUri: 'tel:+639990000001' },
  );
});

test('an API from before `available` still works', () => {
  assert.deepEqual(
    contactFrom({ data: { proxy_contact_number: '+63 999 000 0001' } }, null),
    { number: '+63 999 000 0001', dialUri: 'tel:+639990000001' },
  );
});

test('after 24 hours, and with no answer', () => {
  assert.equal(contactFrom(null, 'Contact access expired.'), 'expired');
  assert.equal(
    contactFrom({ message: 'Contact access expired.' }, null),
    'expired',
  );
  assert.equal(contactFrom(null, 'Network Error'), 'unavailable');
  assert.equal(contactFrom(undefined, undefined), 'unavailable');
});

test('the words name the other party', () => {
  assert.equal(noContactText('Rider'), 'Rider contact number is not available');
  assert.equal(
    noContactText('Passenger'),
    'Passenger contact number is not available',
  );
});

// The Booking Details screen dials only a number the helper gave it.
test('Booking Details reads the answer through contactFrom', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const screen = readFileSync(
    join(root, 'src/Screens/BookingHistoryScreen/BookingDetailsScreen.js'),
    'utf8',
  );
  assert.match(screen, /contactFrom\(response, error\)/);
  assert.match(screen, /noContactText\(/);
  assert.doesNotMatch(screen, /payload\.proxy_contact_number/);
});
