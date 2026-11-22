import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../serviceList.js';
const { NO_FARE, serviceRows } = mod;

const services = [
  { id: 1, title: 'Motorcycle', meta: '1 seat', badge: 'FASTEST' },
  { id: 2, title: 'Car (4 Seaters)', meta: '4 seats' },
  { id: 3, title: 'Car (6 Seaters)', meta: '6 seats' },
];
const fareFor = bookingType => ({
  booking_type: bookingType,
  pretty_total_amount: '₱128.00',
  pretty_eta_pickup_to_dropoff: '25 mins',
});

test('nothing chosen yet: every row shows its meta line and a dash', () => {
  const rows = serviceRows({ services, selectedId: null, fare: null });
  assert.deepEqual(
    rows.map(r => [r.selected, r.meta, r.fare]),
    [
      [false, '1 seat', NO_FARE],
      [false, '4 seats', NO_FARE],
      [false, '6 seats', NO_FARE],
    ],
  );
});

test('the chosen ride shows its fare and trip time once priced; the others a dash', () => {
  const rows = serviceRows({ services, selectedId: 2, fare: fareFor('2') });
  assert.deepEqual(
    rows.map(r => [r.selected, r.meta, r.fare]),
    [
      [false, '1 seat', NO_FARE],
      [true, '25 mins · 4 seats', '₱128.00'],
      [false, '6 seats', NO_FARE],
    ],
  );
});

test('a fare priced for another ride is never shown on the chosen one', () => {
  // chose the 6-seater while the 4-seater's fare is still on hand
  const rows = serviceRows({ services, selectedId: 3, fare: fareFor(2) });
  assert.equal(rows[2].fare, NO_FARE);
  assert.equal(rows[2].meta, '6 seats');
  assert.equal(rows[1].fare, NO_FARE, 'nor on the ride it was priced for, which is not chosen');
});

test('ids match whether they come as numbers or strings', () => {
  assert.equal(serviceRows({ services, selectedId: '1', fare: fareFor(1) })[0].fare, '₱128.00');
  assert.equal(serviceRows({ services, selectedId: 1, fare: fareFor('1') })[0].fare, '₱128.00');
});

test('a placed booking keeps only the chosen ride', () => {
  const rows = serviceRows({ services, selectedId: 1, fare: fareFor(1), selectedOnly: true });
  assert.deepEqual(rows.map(r => r.service.id), [1]);
  assert.deepEqual(serviceRows({ services, selectedId: null, selectedOnly: true }), []);
});

test('a screen reader hears the name, badge, meta and fare, never the dash', () => {
  const priced = serviceRows({ services, selectedId: 1, fare: fareFor(1) });
  assert.equal(priced[0].label, 'Motorcycle, fastest, 25 mins · 1 seat, ₱128.00');
  assert.equal(priced[1].label, 'Car (4 Seaters), 4 seats');
});
