import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../livenessCheck.js';
const {
  start,
  describeFace,
  faceProblem,
  advance,
  isGoodPortrait,
  stepsPassed,
  stepsFor,
  STEPS,
  BLINK_STEPS,
  PORTRAIT_HOLD,
  PICTURE_SIZE,
  MAX_MISSES,
  STEP_TIMEOUT_MS,
} = mod;

// A well-placed face turned `yaw` degrees.
const face = (yaw, extra = {}) => ({
  yaw,
  roll: 0,
  widthRatio: 0.45,
  offCenterX: 0.02,
  offCenterY: 0.05,
  eyesOpen: 0.9,
  ...extra,
});

// Feeds a list of samples (each a list of faces), one per second.
const run = (samples, state = start(0), t0 = 0) => {
  let result = { state, problem: null, done: false };
  samples.forEach((faces, i) => {
    result = advance(result.state, faces, t0 + (i + 1) * 1000);
  });
  return result;
};

const straightTwice = [[face(2)], [face(-3)]];

test('the full sequence: straight, one side, the other side, straight', () => {
  const r = run([...straightTwice, [face(22)], [face(-20)], [face(1)]]);
  assert.equal(r.done, true);
  assert.equal(r.state.step, 'done');
  assert.equal(stepsPassed(r.state), 4);
});

test('either side may come first, but the second turn must be the other side', () => {
  // left first, then right: fine
  assert.equal(
    run([...straightTwice, [face(-25)], [face(18)], [face(0)]]).done,
    true,
  );
  // the same side twice does not pass
  const same = run([...straightTwice, [face(25)], [face(30)], [face(24)]]);
  assert.equal(same.state.step, 'otherTurn');
  assert.equal(same.done, false);
  // and the person is told at once, not left turning the same way
  assert.equal(same.problem, 'same_side');
});

test('no sample that shows a face is left without an answer', () => {
  // asked to look straight, but turned
  let r = run([[face(14)]]);
  assert.equal(r.problem, 'turned');
  assert.equal(r.state.step, 'straight');
  // looking straight: no complaint, even before the step is passed
  r = run([[face(3)]]);
  assert.equal(r.problem, null);
  // asked to turn: waiting for it is not a problem, turning too far is
  r = run([...straightTwice, [face(4)]]);
  assert.equal(r.problem, null);
  r = run([...straightTwice, [face(70)]]);
  assert.equal(r.problem, 'turned_too_far');
  r = run([...straightTwice, [face(20)], [face(-70)]]);
  assert.equal(r.problem, 'turned_too_far');
  // on the way back to the middle between the two turns: just waiting
  r = run([...straightTwice, [face(20)], [face(5)]]);
  assert.equal(r.problem, null);
  assert.equal(r.state.step, 'otherTurn');
  // asked to look straight again, still turned
  r = run([...straightTwice, [face(20)], [face(-20)], [face(-18)]]);
  assert.equal(r.problem, 'turned');
  assert.equal(r.state.step, 'finish');
});

test('a still photo never gets past the first turn', () => {
  const photo = Array.from({ length: 12 }, () => [face(1)]);
  const r = run(photo);
  assert.equal(r.state.step, 'firstTurn');
  assert.equal(r.done, false);
});

test('looking straight has to hold for two samples in a row', () => {
  let r = run([[face(3)]]);
  assert.equal(r.state.step, 'straight');
  r = run([[face(3)], [face(14)], [face(2)]]);
  assert.equal(r.state.step, 'straight'); // the glance away reset the count
  r = run([[face(3)], [face(2)]]);
  assert.equal(r.state.step, 'firstTurn');
});

test('a turn that is too small, or too far round, does not count', () => {
  assert.equal(run([...straightTwice, [face(11)]]).state.step, 'firstTurn');
  assert.equal(run([...straightTwice, [face(70)]]).state.step, 'firstTurn');
  assert.equal(run([...straightTwice, [face(16)]]).state.step, 'otherTurn');
});

test('no face, or more than one, is reported and makes no progress', () => {
  let r = run([[]]);
  assert.equal(r.problem, 'no_face');
  r = run([[face(0), face(3)]]);
  assert.equal(r.problem, 'many_faces');
  assert.equal(r.state.step, 'straight');
});

test('losing the face for a while starts the check over', () => {
  const lost = Array.from({ length: MAX_MISSES }, () => []);
  const r = run([...straightTwice, [face(20)], ...lost]);
  assert.equal(r.problem, 'restarted');
  assert.equal(r.state.step, 'straight');
  assert.equal(r.state.restarts, 1);
  // a brief blink of the detector does not
  const blink = run([...straightTwice, [face(20)], [], [face(-20)]]);
  assert.equal(blink.state.step, 'finish');
});

test('a face too far away or off to the side keeps its progress but waits', () => {
  let r = run([...straightTwice, [face(20, { widthRatio: 0.15 })]]);
  assert.equal(r.problem, 'too_far');
  assert.equal(r.state.step, 'firstTurn');
  r = run([...straightTwice, [face(20, { offCenterX: 0.4 })]]);
  assert.equal(r.problem, 'off_center');
  assert.equal(r.state.step, 'firstTurn');
});

test('the photo waits for open eyes', () => {
  const blink = [face(0, { eyesOpen: 0.02 })];
  let r = run([...straightTwice, [face(20)], [face(-20)], blink]);
  assert.equal(r.problem, 'eyes_closed');
  assert.equal(r.done, false);
  r = run([[face(0)]], r.state, 5000);
  assert.equal(r.done, true);
  // a detector that does not report the eyes does not block
  r = run([
    ...straightTwice,
    [face(20)],
    [face(-20)],
    [face(0, { eyesOpen: null })],
  ]);
  assert.equal(r.done, true);
});

test('a step that takes too long starts the check over', () => {
  const afterStraight = run(straightTwice).state;
  const r = advance(
    afterStraight,
    [face(20)],
    afterStraight.stepStartedAt + STEP_TIMEOUT_MS + 1,
  );
  assert.equal(r.problem, 'restarted');
  assert.equal(r.state.step, 'straight');
});

test('describeFace turns detector output into picture-independent numbers', () => {
  const d = describeFace(
    {
      frame: { left: 200, top: 300, width: 400, height: 500 },
      rotationY: -18.5,
      rotationZ: 2,
      leftEyeOpenProbability: 0.9,
      rightEyeOpenProbability: 0.3,
    },
    800,
    1200,
  );
  assert.equal(d.yaw, -18.5);
  assert.equal(d.widthRatio, 0.5);
  assert.equal(d.offCenterX, 0);
  assert.ok(Math.abs(d.offCenterY - Math.abs(550 / 1200 - 0.5)) < 1e-9);
  assert.equal(d.eyesOpen, 0.3); // the more closed eye
  assert.equal(describeFace({ frame: {} }, 0, 0).eyesOpen, null);
});

test('the final picture must show one well-placed face looking at the camera', () => {
  assert.equal(isGoodPortrait([face(3)]), true);
  assert.equal(isGoodPortrait([face(25)]), false);
  assert.equal(isGoodPortrait([]), false);
  assert.equal(isGoodPortrait([face(0), face(0)]), false);
  assert.equal(isGoodPortrait([face(0, { eyesOpen: 0.02 })]), false);
  // narrow eyes, glasses: scored low by the detector but open
  assert.equal(isGoodPortrait([face(0, { eyesOpen: 0.15 })]), true);
  assert.equal(faceProblem([face(0)]), null);
});

// Riders (the owner, 2026-11-23: "For the rider, the picture validation add a
// blink your eyes or any more strict validation that they are the user").
const rider = () => start(0, { blink: true });
const turns = [...straightTwice, [face(22)], [face(-20)]];
const shut = [face(0, { eyesOpen: 0.01 })];

test('riders also shut their eyes and open them again, then the photo', () => {
  let r = run(turns, rider());
  assert.equal(r.state.step, 'blink');
  assert.equal(stepsPassed(r.state), 3);
  r = run([...turns, shut, [face(1)], [face(0)], [face(2)]], rider());
  assert.equal(r.done, true);
  assert.equal(stepsPassed(r.state), BLINK_STEPS.length);
});

test('eyes that never shut, or never open again, do not pass the blink', () => {
  const open = Array.from({ length: 8 }, () => [face(0)]);
  assert.equal(run([...turns, ...open], rider()).state.step, 'blink');
  const closed = Array.from({ length: 8 }, () => shut);
  assert.equal(run([...turns, ...closed], rider()).state.step, 'blink');
});

test('open again is measured against the eyes themselves', () => {
  // eyes seen at most 0.2 open (narrow, glasses): 0.13 is open again
  const narrow = (yaw, eyesOpen = 0.2) => [face(yaw, { eyesOpen })];
  const r = run(
    [
      narrow(2),
      narrow(-3),
      narrow(22),
      narrow(-20),
      narrow(0, 0.02),
      narrow(0, 0.13),
    ],
    rider(),
  );
  assert.equal(r.state.step, 'finish');
  // wide eyes (0.9) at 0.3 are still opening
  const half = run([...turns, shut, [face(0, { eyesOpen: 0.3 })]], rider());
  assert.equal(half.state.step, 'blink');
});

test('the eyes are not read on a face turned away', () => {
  const r = run([...turns, [face(25, { eyesOpen: 0.01 })]], rider());
  assert.equal(r.problem, 'turned');
  assert.equal(r.state.eyesShut, false);
});

test("after the blink the rider's photo waits for a settled face", () => {
  const blinked = run([...turns, shut, [face(0)]], rider());
  assert.equal(blinked.state.step, 'finish');
  let r = blinked;
  for (let i = 1; i < PORTRAIT_HOLD; i += 1) {
    r = run([[face(1)]], r.state, 10000 + i * 1000);
    assert.equal(r.done, false);
  }
  r = run([[face(2)]], r.state, 20000);
  assert.equal(r.done, true);
});

test('starting over keeps the blink; passengers keep four steps', () => {
  const lost = Array.from({ length: MAX_MISSES }, () => []);
  const r = run([...straightTwice, [face(20)], ...lost], rider());
  assert.equal(r.problem, 'restarted');
  assert.deepEqual(r.state.steps, BLINK_STEPS);
  assert.deepEqual(start(0).steps, STEPS);
  assert.deepEqual(stepsFor(), STEPS);
  assert.deepEqual(stepsFor({ blink: true }), BLINK_STEPS);
});

test('the camera is asked for a modest picture, as width x height', () => {
  const match = /^(\d+)x(\d+)$/.exec(PICTURE_SIZE);
  assert.ok(match, PICTURE_SIZE);
  const [long, short] = [Number(match[1]), Number(match[2])];
  // wide first, as cameras state their sizes; big enough for a clear
  // profile photo, small enough to take and scan several times a second
  assert.ok(long > short);
  assert.ok(long >= 960 && long <= 1600, PICTURE_SIZE);
});
