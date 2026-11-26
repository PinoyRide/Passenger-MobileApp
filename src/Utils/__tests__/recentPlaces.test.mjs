import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../recentPlaces.js';

const { MAX_KEPT, recentPlacesFrom, withBooking, titleOf, subtitleOf } = mod;

const trip = (created_at, pickup, dropoff) => ({
  created_at,
  pickup_location: pickup[0],
  pickup_lat: pickup[1],
  pickup_long: pickup[2],
  dropoff_location: dropoff[0],
  dropoff_lat: dropoff[1],
  dropoff_long: dropoff[2],
});

const CONDO = ['Avida Towers, Makati', '14.5547', '121.0244'];
const SM = ['SM North EDSA, North Ave, Quezon City', '14.6568', '121.0305'];
const OFFICE = ['RCBC Plaza, Ayala Ave, Makati', 14.5597, 121.0187];
const AIRPORT = ['NAIA Terminal 3, Pasay', 14.5204, 121.0194];

test("the latest trip's drop-off comes first, then its pick-up, each place once", () => {
  const places = recentPlacesFrom([
    trip('2026-11-20T08:00:00Z', CONDO, OFFICE),
    trip('2026-11-22T18:00:00Z', OFFICE, SM),
    // the same condo, a few metres off and written another way
    trip('2026-11-21T09:00:00Z', ['Avida Towers Makati lobby', '14.55472', '121.02441'], AIRPORT),
  ]);
  assert.deepEqual(
    places.map(p => p.address),
    [SM[0], OFFICE[0], AIRPORT[0], 'Avida Towers Makati lobby'],
  );
  assert.equal(places[0].lat, 14.6568);
});

test('a saved place (Home, Work) is left out: the shortcuts already have it', () => {
  const places = recentPlacesFrom([trip('2026-11-22T18:00:00Z', CONDO, SM)], [
    { type: 'home', address: 'Home', lat: 14.5547, long: 121.0244 },
  ]);
  assert.deepEqual(places.map(p => p.address), [SM[0]]);
});

test('places without a position or a name are skipped, and the list is kept short', () => {
  const places = recentPlacesFrom([
    trip('2026-11-22T18:00:00Z', ['', '14.5', '121.0'], ['Somewhere', null, '121.0']),
    trip('2026-11-21T18:00:00Z', ['Zero', 0, 0], SM),
  ]);
  assert.deepEqual(places.map(p => p.address), [SM[0]]);
  const many = Array.from({ length: 12 }, (_, i) =>
    trip(`2026-11-${10 + i}T08:00:00Z`, [`P${i}`, 14 + i * 0.01, 121], [`D${i}`, 15 + i * 0.01, 121]),
  );
  assert.equal(recentPlacesFrom(many).length, MAX_KEPT);
  assert.equal(recentPlacesFrom(null).length, 0);
});

test('a trip just booked goes in front', () => {
  const before = recentPlacesFrom([trip('2026-11-20T08:00:00Z', CONDO, OFFICE)]);
  const after = withBooking(before, trip('2026-11-23T08:00:00Z', OFFICE, AIRPORT));
  assert.deepEqual(
    after.map(p => p.address),
    [AIRPORT[0], OFFICE[0], CONDO[0]],
  );
});

test('a row shows the name, then the rest of the address', () => {
  const place = { address: 'SM North EDSA, North Ave, Quezon City' };
  assert.equal(titleOf(place), 'SM North EDSA');
  assert.equal(subtitleOf(place), 'North Ave, Quezon City');
  assert.equal(subtitleOf({ address: 'Makati' }), '');
});
