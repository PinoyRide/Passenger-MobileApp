import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../routeDirections.js';
const { trimRouteAlongRoad } = mod;

// Straight road going north along lng 121.0
const road = [
  { latitude: 14.6, longitude: 121.0 },
  { latitude: 14.601, longitude: 121.0 },
  { latitude: 14.602, longitude: 121.0 },
  { latitude: 14.603, longitude: 121.0 },
];

test('line starts on the road at the rider, not at a skipped vertex', () => {
  const rider = { latitude: 14.6015, longitude: 121.00002 };
  const { coords } = trimRouteAlongRoad(road, rider);
  assert.ok(Math.abs(coords[0].latitude - 14.6015) < 1e-6);
  assert.ok(Math.abs(coords[0].longitude - 121.0) < 1e-9);
  assert.deepEqual(coords.slice(1), road.slice(2));
});

test('nothing is left behind the rider as they move', () => {
  const rider = { latitude: 14.6029, longitude: 121.0 };
  const { coords } = trimRouteAlongRoad(road, rider);
  assert.equal(coords.length, 2);
  assert.ok(coords.every(p => p.latitude >= 14.6029 - 1e-9));
});

test('reports distance off the road', () => {
  const rider = { latitude: 14.6015, longitude: 121.001 };
  const { offRouteMeters } = trimRouteAlongRoad(road, rider);
  assert.ok(offRouteMeters > 100 && offRouteMeters < 120);
});

test('empty route or no rider passes through', () => {
  assert.deepEqual(trimRouteAlongRoad([], road[0]).coords, []);
  assert.deepEqual(trimRouteAlongRoad(road, null).coords, road);
});
