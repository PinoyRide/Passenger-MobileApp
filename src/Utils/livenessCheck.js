// Selfie liveness check. Pure (no RN imports) so it runs under `node --test`.
//
// A profile photo has to be taken live, by the person themselves: not picked
// from the gallery and not a photo of a photo. The camera screen asks for a
// short sequence of head movements and watches the face through them:
//
//   straight   look straight at the camera
//   firstTurn  turn the head slightly to one side
//   otherTurn  turn it slightly to the other side
//   finish     look straight again, and the photo is taken
//
// A printed or on-screen photo cannot turn its head, so it never gets past
// the first turn. This is a deterrent, not bank-grade verification: someone
// determined could still play back a video of a person turning their head.
//
// The screen samples the camera a few times a second and feeds what the face
// detector found to `advance`. Every sample answers with either progress or
// a reason, so the person is never left wondering what is being waited for.

// The picture the camera is asked for (Android), set before it first opens.
// At the camera's full size a sample takes several seconds on a phone with a
// large front camera; at this size it takes a fraction of one, and the photo
// that is kept is still clear. A phone that does not have exactly this size
// uses its nearest one.
const PICTURE_SIZE = '1280x960';

// |yaw| up to this counts as looking straight at the camera (degrees).
const STRAIGHT_MAX_YAW = 10;
// A "slight" turn: at least this much...
const TURN_MIN_YAW = 15;
// ...and not so far round that the face can no longer be read reliably.
const TURN_MAX_YAW = 55;
// The face must fill at least this much of the picture's width.
const MIN_FACE_WIDTH = 0.28;
// The middle of the face must be within this of the picture's middle.
const MAX_OFF_CENTER = 0.22;
// Looking straight is confirmed over this many samples in a row.
const STRAIGHT_HOLD = 2;
// This many samples in a row without exactly one face, and the check starts
// over: the person may have stepped away and someone else stepped in.
const MAX_MISSES = 4;
// A step not completed in this long starts the check over.
const STEP_TIMEOUT_MS = 25000;
// The photo is not taken mid-blink. The bar is low on purpose: the detector
// scores some open eyes (narrow eyes, glasses, looking slightly down) as low
// as 0.15, and a real passenger must never be stuck here. A blink scores
// close to zero and is gone by the next sample.
const EYES_OPEN_MIN = 0.08;

const STEPS = ['straight', 'firstTurn', 'otherTurn', 'finish'];

const start = (now = 0) => ({
  step: 'straight',
  // +1 or -1: the side of the first turn (the sign of its yaw).
  firstSide: 0,
  held: 0,
  misses: 0,
  stepStartedAt: now,
  restarts: 0,
});

const restart = (state, now) => ({
  ...start(now),
  restarts: state.restarts + 1,
});

const goTo = (state, step, now, extra = {}) => ({
  ...state,
  ...extra,
  step,
  held: 0,
  misses: 0,
  stepStartedAt: now,
});

/**
 * What the detector saw in one camera sample, in picture-independent terms.
 * `face` is one face from the detector ({ frame, rotationX/Y/Z, ...});
 * width and height are the picture's.
 */
function describeFace(face, width, height) {
  const frame = face.frame || {};
  const w = width > 0 ? width : 1;
  const h = height > 0 ? height : 1;
  const eyes = [face.leftEyeOpenProbability, face.rightEyeOpenProbability]
    .map(Number)
    .filter(Number.isFinite);
  return {
    yaw: Number(face.rotationY) || 0,
    roll: Number(face.rotationZ) || 0,
    widthRatio: (Number(frame.width) || 0) / w,
    offCenterX: Math.abs(
      ((Number(frame.left) || 0) + (Number(frame.width) || 0) / 2) / w - 0.5,
    ),
    offCenterY: Math.abs(
      ((Number(frame.top) || 0) + (Number(frame.height) || 0) / 2) / h - 0.5,
    ),
    // null when the detector did not classify the eyes
    eyesOpen: eyes.length ? Math.min(...eyes) : null,
  };
}

/** Why this sample cannot be used, or null when the face is well placed. */
function faceProblem(faces) {
  if (!faces || faces.length === 0) {
    return 'no_face';
  }
  if (faces.length > 1) {
    return 'many_faces';
  }
  const face = faces[0];
  if (face.widthRatio < MIN_FACE_WIDTH) {
    return 'too_far';
  }
  if (face.offCenterX > MAX_OFF_CENTER || face.offCenterY > MAX_OFF_CENTER) {
    return 'off_center';
  }
  return null;
}

/**
 * Folds one camera sample into the check.
 * faces: results of describeFace for every face in the sample.
 * Returns { state, problem, done }:
 *   problem: why this sample made no progress, for the hint on the screen:
 *            'no_face' | 'many_faces' | 'too_far' | 'off_center' |
 *            'turned' (asked to look straight, but turned) |
 *            'same_side' (the second turn went the same way as the first) |
 *            'turned_too_far' | 'eyes_closed' | 'restarted' |
 *            null (progress, or simply waiting for the turn asked for)
 *   done:    true once every step has been passed.
 */
function advance(state, faces, now) {
  if (state.step === 'done') {
    return { state, problem: null, done: true };
  }
  if (now - state.stepStartedAt > STEP_TIMEOUT_MS) {
    return { state: restart(state, now), problem: 'restarted', done: false };
  }

  const problem = faceProblem(faces);
  if (problem === 'no_face' || problem === 'many_faces') {
    const misses = state.misses + 1;
    // Past the first step, losing the face for a while starts it over.
    if (misses >= MAX_MISSES && state.step !== 'straight') {
      return { state: restart(state, now), problem: 'restarted', done: false };
    }
    return { state: { ...state, misses, held: 0 }, problem, done: false };
  }
  if (problem) {
    // A face is there, just badly placed: keep the progress, ask to adjust.
    return { state: { ...state, misses: 0, held: 0 }, problem, done: false };
  }

  const { yaw, eyesOpen } = faces[0];
  const turn = Math.abs(yaw);
  const side = yaw >= 0 ? 1 : -1;
  const present = { ...state, misses: 0 };

  switch (state.step) {
    case 'straight': {
      if (turn > STRAIGHT_MAX_YAW) {
        return {
          state: { ...present, held: 0 },
          problem: 'turned',
          done: false,
        };
      }
      const held = state.held + 1;
      return {
        state:
          held >= STRAIGHT_HOLD
            ? goTo(present, 'firstTurn', now)
            : { ...present, held },
        problem: null,
        done: false,
      };
    }
    case 'firstTurn':
      // Either side is accepted first; the next step must be the other one.
      if (turn >= TURN_MIN_YAW && turn <= TURN_MAX_YAW) {
        return {
          state: goTo(present, 'otherTurn', now, { firstSide: side }),
          problem: null,
          done: false,
        };
      }
      return {
        state: present,
        problem: turn > TURN_MAX_YAW ? 'turned_too_far' : null,
        done: false,
      };
    case 'otherTurn':
      if (
        turn >= TURN_MIN_YAW &&
        turn <= TURN_MAX_YAW &&
        side === -state.firstSide
      ) {
        return {
          state: goTo(present, 'finish', now),
          problem: null,
          done: false,
        };
      }
      if (turn > TURN_MAX_YAW) {
        return { state: present, problem: 'turned_too_far', done: false };
      }
      return {
        state: present,
        // still turned the way of the first turn
        problem:
          turn >= TURN_MIN_YAW && side === state.firstSide ? 'same_side' : null,
        done: false,
      };
    case 'finish':
      if (turn > STRAIGHT_MAX_YAW) {
        return { state: present, problem: 'turned', done: false };
      }
      if (eyesOpen != null && eyesOpen < EYES_OPEN_MIN) {
        return { state: present, problem: 'eyes_closed', done: false };
      }
      return { state: goTo(present, 'done', now), problem: null, done: true };
    default:
      return { state: present, problem: null, done: false };
  }
}

/**
 * Whether a picture is fit to be the profile photo: exactly one face, well
 * placed, looking at the camera. Used on the final, full-quality picture.
 */
function isGoodPortrait(faces) {
  return (
    faceProblem(faces) === null &&
    Math.abs(faces[0].yaw) <= STRAIGHT_MAX_YAW &&
    (faces[0].eyesOpen == null || faces[0].eyesOpen >= EYES_OPEN_MIN)
  );
}

/** How far through the check the passenger is, 0 to 4 steps passed. */
const stepsPassed = state =>
  state.step === 'done' ? STEPS.length : STEPS.indexOf(state.step);

module.exports = {
  STEPS,
  PICTURE_SIZE,
  STRAIGHT_MAX_YAW,
  TURN_MIN_YAW,
  TURN_MAX_YAW,
  MIN_FACE_WIDTH,
  MAX_MISSES,
  STEP_TIMEOUT_MS,
  start,
  describeFace,
  faceProblem,
  advance,
  isGoodPortrait,
  stepsPassed,
};
