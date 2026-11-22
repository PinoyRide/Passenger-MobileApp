import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../fareInquiry.js';
import peso from '../formatPeso.js';
const { fareKey, shouldPrice } = mod;
const { formatPeso } = peso;

const pickup = { lat: 14.5352, long: 120.9822, address: 'SM Mall of Asia' };
const dropoff = { lat: '14.5547', long: '121.0244', address: 'Ayala' };

test('no fare is asked for until pickup, drop-off and a ride are all set', () => {
  assert.equal(fareKey({ pickup, dropoff, serviceId: null }), null);
  assert.equal(fareKey({ pickup, dropoff: null, serviceId: 1 }), null);
  assert.equal(fareKey({ pickup: { lat: null, long: 1 }, dropoff, serviceId: 1 }), null);
  assert.equal(fareKey({ pickup, dropoff: { lat: 'x', long: 1 }, serviceId: 1 }), null);
  assert.ok(fareKey({ pickup, dropoff, serviceId: 1 }));
});

test('a fare belongs to one trip: ride, points, promo and pickup time', () => {
  const base = { pickup, dropoff, serviceId: 1, promoId: null, scheduledAt: null };
  const key = fareKey(base);
  assert.notEqual(fareKey({ ...base, serviceId: 2 }), key, 'another ride');
  assert.notEqual(fareKey({ ...base, dropoff: { lat: 14.6, long: 121 } }), key, 'another drop-off');
  assert.notEqual(fareKey({ ...base, promoId: 9 }), key, 'a promo');
  assert.notEqual(fareKey({ ...base, scheduledAt: new Date('2026-11-23T02:00:00Z') }), key, 'a pickup time');
  // the same trip, however its parts are written
  assert.equal(fareKey({ ...base, serviceId: '1', pickup: { lat: '14.5352', long: '120.9822' } }), key);
  assert.equal(fareKey({ ...base, scheduledAt: 'not a date' }), key);
});

test('it asks once per trip, and never while held or already asking', () => {
  const key = 'k1';
  const ask = over => shouldPrice({ key, held: false, loading: false, pricedKey: null, failedKey: null, ...over });
  assert.equal(ask({}), true);
  assert.equal(ask({ key: null }), false, 'trip incomplete');
  assert.equal(ask({ held: true }), false, 'booking placed, pickup panel, offline');
  assert.equal(ask({ loading: true }), false, 'an inquiry is on its way');
  assert.equal(ask({ pricedKey: 'k1' }), false, 'already priced');
  assert.equal(ask({ failedKey: 'k1' }), false, 'refused once: not asked again by itself');
  assert.equal(ask({ pricedKey: 'k0', failedKey: 'k0' }), true, 'another trip');
});

test('amounts read as pesos, as on the booking status screen', () => {
  assert.equal(formatPeso(128), '₱128.00');
  assert.equal(formatPeso('96.5'), '₱96.50');
  assert.equal(formatPeso(undefined), '₱0.00');
});
