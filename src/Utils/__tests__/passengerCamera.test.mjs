import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../passengerCamera.js';
const { framePoints, isUserControlling, MIN_SPAN_DEG, USER_PAUSE_MS } = mod;

const rider = { latitude: 14.62, longitude: 121.03 };
const pickup = { latitude: 14.6, longitude: 121.01 };

test('far apart: frames exactly rider and pickup', () => {
  const pts = framePoints(rider, pickup);
  assert.deepEqual(pts, [rider, pickup]);
});

test('close together: pads to a minimum span so it is not too zoomed in', () => {
  const near = { latitude: 14.6001, longitude: 121.0101 };
  const pts = framePoints(near, pickup);
  const lats = pts.map(p => p.latitude);
  const lngs = pts.map(p => p.longitude);
  assert.ok(Math.max(...lats) - Math.min(...lats) >= MIN_SPAN_DEG - 1e-9);
  assert.ok(Math.max(...lngs) - Math.min(...lngs) >= MIN_SPAN_DEG - 1e-9);
  // both real points are still included
  assert.ok(pts.includes(near) && pts.includes(pickup));
});

test('missing a point: nothing to frame', () => {
  assert.equal(framePoints(null, pickup), null);
  assert.equal(framePoints(rider, null), null);
});

test('auto-framing pauses while the user is touching the map', () => {
  assert.equal(isUserControlling(0, 1000), false);
  assert.equal(isUserControlling(1000, 1000 + USER_PAUSE_MS - 1), true);
  assert.equal(isUserControlling(1000, 1000 + USER_PAUSE_MS), false);
});

test('tight floor: about 150 m so a nearby rider is zoomed right in', () => {
  assert.ok(MIN_SPAN_DEG <= 0.0014 && MIN_SPAN_DEG >= 0.0012);
});

// ---- follow view -------------------------------------------------------
const {
  followsByDefault,
  followCamera,
  needsFollowStep,
  needsReframe,
  FOLLOW_BEHIND_METERS,
  FOLLOW_TRAVEL_METERS,
} = mod;
import nav from '../navMath.js';

test('in transit the map follows the vehicle; before that it shows rider and pickup', () => {
  assert.equal(followsByDefault(2), true);
  assert.equal(followsByDefault('2'), true);
  assert.equal(followsByDefault(1), false);
  assert.equal(followsByDefault(0), false);
});

test('the follow camera faces the way the vehicle is going, with the vehicle below centre', () => {
  const cam = followCamera(rider, 90); // facing east
  assert.equal(cam.heading, 90);
  assert.ok(cam.pitch > 0);
  // the centre of the map is ahead of the vehicle, so the vehicle sits below it
  assert.ok(Math.abs(nav.distanceMeters(rider, cam.center) - FOLLOW_BEHIND_METERS) < 1);
  assert.ok(Math.abs(nav.bearingDegrees(rider, cam.center) - 90) < 1);
});

test('the follow camera holds still while the vehicle drives up the screen', () => {
  assert.equal(needsFollowStep(null, rider, 0), true); // first time
  const last = { rider, heading: 0 };
  assert.equal(needsFollowStep(last, rider, 0), false); // stopped
  assert.equal(needsFollowStep(last, nav.pointAhead(rider, 0, 40), 3), false); // driving on
  assert.equal(needsFollowStep(last, nav.pointAhead(rider, 0, FOLLOW_TRAVEL_METERS + 1), 0), true);
});

test('a turn steps the follow camera at once, a wobble does not', () => {
  const last = { rider, heading: 350 };
  assert.equal(needsFollowStep(last, rider, 10), false); // 20 degrees, across north
  assert.equal(needsFollowStep(last, rider, 20), true); // 30 degrees
  assert.equal(needsFollowStep(last, rider, 260), true); // left turn
});

test('the overview re-frames only once the rider has moved', () => {
  assert.equal(needsReframe(null, rider), true);
  assert.equal(needsReframe(rider, rider), false);
  assert.equal(needsReframe(rider, nav.pointAhead(rider, 45, 3)), true);
});
