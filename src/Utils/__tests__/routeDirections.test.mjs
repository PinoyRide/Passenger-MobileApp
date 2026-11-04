import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../routeDirections.js';
const { decodePolyline, routeFromDirections, shouldRefetchRoute } = mod;

// "_p~iF~ps|U_ulLnnqC_mqNvxq`@" is Google's documented sample polyline.
const SAMPLE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

test('decodes the Google sample polyline', () => {
  const pts = decodePolyline(SAMPLE);
  assert.equal(pts.length, 3);
  assert.deepEqual(pts[0], { latitude: 38.5, longitude: -120.2 });
  assert.deepEqual(pts[2], { latitude: 43.252, longitude: -126.453 });
});

test('builds the line from detailed step polylines, not the overview', () => {
  const data = {
    status: 'OK',
    routes: [
      {
        overview_polyline: { points: '_p~iF~ps|U' },
        legs: [
          {
            start_location: { lat: 1, lng: 2 },
            end_location: { lat: 3, lng: 4 },
            steps: [
              { polyline: { points: SAMPLE } },
              { polyline: { points: SAMPLE } },
            ],
          },
        ],
      },
    ],
  };
  const r = routeFromDirections(data);
  assert.equal(r.ok, true);
  // two steps of 3 points, shared joint de-duplicated only when identical
  assert.ok(r.coords.length >= 5);
  assert.deepEqual(r.leg.start_location, { lat: 1, lng: 2 });
});

test('falls back to overview when steps are missing', () => {
  const r = routeFromDirections({
    status: 'OK',
    routes: [{ overview_polyline: { points: SAMPLE }, legs: [{}] }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.coords.length, 3);
});

test('rejected or empty responses are not ok', () => {
  assert.equal(routeFromDirections({ status: 'REQUEST_DENIED', routes: [] }).ok, false);
  assert.equal(routeFromDirections({ status: 'OK', routes: [] }).ok, false);
  assert.equal(routeFromDirections(null).ok, false);
});

test('refetches after 15s or 50m of movement, not before', () => {
  const a = { latitude: 14.6, longitude: 121.0 };
  const near = { latitude: 14.6002, longitude: 121.0 }; // ~22m
  const far = { latitude: 14.6006, longitude: 121.0 }; // ~67m
  assert.equal(shouldRefetchRoute({ lastAt: 0, lastPos: a, now: 5000, pos: near }), false);
  assert.equal(shouldRefetchRoute({ lastAt: 0, lastPos: a, now: 5000, pos: far }), true);
  assert.equal(shouldRefetchRoute({ lastAt: 0, lastPos: a, now: 16000, pos: a }), true);
  assert.equal(shouldRefetchRoute({ lastAt: 0, lastPos: null, now: 1000, pos: a }), true);
  assert.equal(shouldRefetchRoute({ lastAt: 0, lastPos: a, now: 1000, pos: null }), false);
});
