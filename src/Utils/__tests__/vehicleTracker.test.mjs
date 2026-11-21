import test from 'node:test';
import assert from 'node:assert/strict';
import tracker from '../vehicleTracker.js';
import nav from '../navMath.js';
const {
  measureRoute,
  projectOnRoute,
  pointAtProgress,
  applyFix,
  predictProgress,
  easeProgress,
  easeAngle,
  remainingRoute,
} = tracker;
const { pointAhead, distanceMeters } = nav;

const start = { latitude: 14.585, longitude: 121.0567 };
// 1 km due south, then 500 m due east.
const corner = pointAhead(start, 180, 1000);
const end = pointAhead(corner, 90, 500);
const route = measureRoute([start, corner, end]);
const along = m => pointAtProgress(route, m);
const fix = (m, at, id, sideMeters = 0) => {
  const p = along(m);
  const moved = sideMeters ? pointAhead(p, 90, sideMeters) : p;
  return { latitude: moved.latitude, longitude: moved.longitude, at, id };
};

test('route length and points along it', () => {
  assert.ok(Math.abs(route.length - 1500) < 2);
  assert.ok(Math.abs(along(500).bearing - 180) < 1); // heading south
  assert.ok(Math.abs(along(1200).bearing - 90) < 1); // then east
  assert.ok(distanceMeters(along(1500), end) < 1);
});

test('a fix beside the road is pinned onto it', () => {
  const p = projectOnRoute(route, fix(400, 0, 'a', 12), null);
  assert.ok(Math.abs(p.progress - 400) < 2);
  assert.ok(Math.abs(p.offMeters - 12) < 1);
});

test('speed comes from consecutive fixes and predicts the position now', () => {
  let s = applyFix(null, route, fix(100, 1000, 'a'));
  s = applyFix(s, route, fix(112, 2000, 'b')); // 12 m in 1 s
  assert.ok(Math.abs(s.speed - 12) < 0.5);
  // 2 s after that fix the vehicle should be ~24 m further on
  assert.ok(Math.abs(predictProgress(s, 4000) - 136) < 1.5);
});

test('prediction stops after 5 s without a new fix', () => {
  let s = applyFix(null, route, fix(100, 1000, 'a'));
  s = applyFix(s, route, fix(110, 2000, 'b'));
  assert.equal(predictProgress(s, 60000), predictProgress(s, 7000));
  assert.ok(predictProgress(s, 7000) > predictProgress(s, 6000));
});

test('speed is measured over several fixes, so one mistimed fix does not swing it', () => {
  let s = applyFix(null, route, fix(100, 1000, 'a'));
  s = applyFix(s, route, fix(110, 2000, 'b'));
  s = applyFix(s, route, fix(120, 3000, 'c'));
  // 10 m further, but stamped 400 ms early: on its own that reads 16.7 m/s
  s = applyFix(s, route, fix(130, 3600, 'd'));
  assert.ok(s.speed > 10 && s.speed < 12.5, `speed ${s.speed}`);
});

test('uneven fixes (a jump, then two small steps) still give the average speed', () => {
  // what a phone's location smoothing can do to a steady 15 m/s
  let s = applyFix(null, route, fix(100, 1000, 'a'));
  let m = 100;
  let t = 1000;
  const speeds = [];
  for (const step of [33, 9, 3, 33, 9, 3, 33, 9, 3]) {
    m += step;
    t += 1000;
    s = applyFix(s, route, fix(m, t, `f${t}`));
    speeds.push(s.speed);
  }
  for (const v of speeds.slice(2)) {
    assert.ok(Math.abs(v - 15) < 0.5, `speed ${v}`);
  }
});

test('a phone that keeps reporting the same fix is standing still', () => {
  let s = applyFix(null, route, fix(100, 1000, 'a'));
  s = applyFix(s, route, { ...fix(112, 2000, 'b'), heardAt: 2300 });
  // moving: predicted ahead of the fix
  assert.ok(Math.abs(predictProgress(s, 4000) - 136) < 1.5);
  // the phone reports in again 3.6 s after that fix, with nothing newer
  s = applyFix(s, route, { ...fix(112, 2100, 'b'), heardAt: 5600 });
  assert.ok(Math.abs(predictProgress(s, 6000) - 112) < 0.5);
  // an older report for the same fix changes nothing
  assert.equal(applyFix(s, route, { ...fix(112, 2100, 'b'), heardAt: 4000 }), s);
});

test('after a stop the speed is measured afresh', () => {
  let s = applyFix(null, route, fix(100, 1000, 'a'));
  s = applyFix(s, route, fix(112, 2000, 'b'));
  s = applyFix(s, route, fix(112, 3000, 'c')); // stopped
  assert.equal(s.speed, 0);
  s = applyFix(s, route, fix(118, 4000, 'd')); // pulls away at 6 m/s
  assert.ok(Math.abs(s.speed - 6) < 0.5, `speed ${s.speed}`);
});

test('the same fix polled twice does not look like a stop', () => {
  let s = applyFix(null, route, fix(100, 1000, 'a'));
  s = applyFix(s, route, fix(110, 2000, 'b'));
  const again = applyFix(s, route, { ...fix(110, 2900, 'b') });
  assert.equal(again, s);
});

test('an older fix arriving late is ignored (no jump back)', () => {
  let s = applyFix(null, route, fix(100, 1000, 'a'));
  s = applyFix(s, route, fix(120, 3000, 'c'));
  const late = applyFix(s, route, fix(110, 2000, 'b'));
  assert.equal(late, s);
});

test('GPS jitter never moves the vehicle backwards', () => {
  let s = applyFix(null, route, fix(300, 1000, 'a'));
  s = applyFix(s, route, fix(292, 2000, 'b')); // 8 m "behind"
  assert.ok(Math.abs(s.fixProgress - 300) < 0.01);
  assert.equal(s.speed, 0);
});

test('a stopped vehicle stops being predicted forward', () => {
  let s = applyFix(null, route, fix(100, 1000, 'a'));
  s = applyFix(s, route, fix(112, 2000, 'b'));
  s = applyFix(s, route, fix(112, 3000, 'c'));
  assert.equal(s.speed, 0);
  assert.ok(Math.abs(predictProgress(s, 5000) - 112) < 0.5);
});

test('far from the route counts as off-route and uses the raw position', () => {
  const s = applyFix(null, route, fix(400, 1000, 'a', 120));
  assert.equal(s.offRoute, true);
  assert.equal(predictProgress(s, 2000), null);
  assert.ok(s.offMeters > 100);
});

test('a looping route pins to the nearby pass, not the far one', () => {
  // Out 400 m south, U-turn, back north 10 m to the side: the two passes are 10 m apart.
  const a = start;
  const b = pointAhead(a, 180, 400);
  const c = pointAhead(b, 90, 10);
  const d = pointAhead(c, 0, 400);
  const loop = measureRoute([a, b, c, d]);
  let s = applyFix(null, loop, {
    ...pointAtProgress(loop, 100),
    at: 1000,
    id: 'a',
  });
  // Next fix sits between the two passes, slightly nearer the return pass.
  const between = pointAhead(pointAtProgress(loop, 112), 90, 6);
  s = applyFix(s, loop, { ...between, at: 2000, id: 'b' });
  assert.ok(Math.abs(s.fixProgress - 112) < 3, `got ${s.fixProgress}`);
});

test('drawn position eases toward the prediction and never goes back', () => {
  assert.equal(easeProgress(null, 50, 0.016), 50);
  const step = easeProgress(100, 110, 0.1);
  assert.ok(step > 100 && step < 110);
  assert.equal(easeProgress(100, 90, 0.1), 100);
});

test('heading turns the short way round', () => {
  const h = easeAngle(350, 10, 0.1);
  assert.ok(h > 350 || h < 10);
  assert.equal(easeAngle(null, 90, 0.1), 90);
});

test('remaining route starts at the vehicle', () => {
  const rest = remainingRoute(route, 400);
  assert.ok(distanceMeters(rest[0], along(400)) < 0.5);
  assert.equal(rest.length, 3); // vehicle, corner, end
  assert.equal(remainingRoute(route, 1200).length, 2); // vehicle, end
});

test('the vehicle does follow the route round a U-turn onto the return pass', () => {
  const a = start;
  const b = pointAhead(a, 180, 400);
  const c = pointAhead(b, 90, 10);
  const d = pointAhead(c, 0, 400);
  const loop = measureRoute([a, b, c, d]);
  let s = null;
  let t = 0;
  for (let m = 0; m <= 800; m += 12) {
    s = applyFix(s, loop, {
      ...pointAtProgress(loop, m),
      at: (t += 1000),
      id: m,
    });
    assert.ok(
      Math.abs(s.fixProgress - m) < 1.5,
      `at ${m} got ${s.fixProgress}`,
    );
  }
});

test('on a straight road the pin is the nearest point, not an earlier one', () => {
  const pts = [];
  for (let m = 0; m <= 300; m += 10) {
    pts.push(pointAhead(start, 180, m));
  }
  const fine = measureRoute(pts);
  const p = projectOnRoute(
    fine,
    pointAhead(pointAtProgress(fine, 157), 90, 6),
    null,
  );
  assert.ok(Math.abs(p.progress - 157) < 1, `got ${p.progress}`);
});
