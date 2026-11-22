import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../placeSession.js';

const { SESSION_MAX_MS, newToken, sessionFor, nearOf, suggestionsFrom, placeFrom } =
  mod;

test('a session token is a UUID v4, as Google asks', () => {
  assert.match(
    newToken(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.notEqual(newToken(), newToken());
});

test('one search keeps its session; an old one starts afresh', () => {
  const first = sessionFor(null, 1000);
  assert.equal(sessionFor(first, 1000 + 60_000), first);
  const later = sessionFor(first, 1000 + SESSION_MAX_MS);
  assert.notEqual(later.token, first.token);
  assert.equal(later.startedAt, 1000 + SESSION_MAX_MS);
});

test('the other point of the trip goes along, so each suggestion says how far it is', () => {
  assert.equal(nearOf({ lat: 14.5547, long: 121.0244 }), '14.5547,121.0244');
  assert.equal(nearOf({ lat: '14.5', long: '121' }), '14.5,121');
  assert.equal(nearOf(null), '');
  assert.equal(nearOf({ lat: null, long: 121 }), '');
});

test('suggestions come without coordinates, with their distance', () => {
  const items = suggestionsFrom([
    {
      placeId: 'A',
      displayName: 'SM North EDSA',
      description: 'SM North EDSA, North Ave, QC',
      address: 'SM North EDSA\nNorth Ave, QC',
      distanceMeters: 5230,
    },
    { placeId: 'B', displayName: 'SM Megamall', description: 'SM Megamall', address: 'SM Megamall' },
    { displayName: 'no id' },
  ]);
  assert.deepEqual(
    items.map(i => [i.place_id, i.distance_km]),
    [
      ['A', 5.23],
      ['B', null],
    ],
  );
  assert.equal(items[0].lat, undefined);
  assert.deepEqual(suggestionsFrom(null), []);
});

test('the picked place takes its location from places/details', () => {
  const [picked] = suggestionsFrom([
    { placeId: 'A', displayName: 'SM North EDSA', description: 'SM North EDSA, QC', address: 'SM North EDSA\nQC' },
  ]);
  const place = placeFrom(
    { placeId: 'A', displayName: 'SM North EDSA', address: 'SM North EDSA\nNorth Ave, Quezon City', lat: 14.656, long: 121.03 },
    picked,
  );
  assert.equal(place.lat, 14.656);
  assert.equal(place.long, 121.03);
  assert.equal(place.description, 'SM North EDSA, QC');
  assert.equal(place.address, 'SM North EDSA\nQC');
  assert.equal(placeFrom(null, picked), null);
  assert.equal(placeFrom({ lat: 'x', long: 1 }, picked), null);
});
