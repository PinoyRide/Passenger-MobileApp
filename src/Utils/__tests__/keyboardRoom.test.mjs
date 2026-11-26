import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../keyboardRoom.js';

// A-326 (the owner, 2026-11-26: "the keyboard covers the text box"): a form
// keeps the field being typed in above the keyboard and Gboard's suggestion
// bar. The same file in both apps (sharedUi.test.mjs).
const { FIELD_GAP, ERROR_LINE, TOP_GAP, keyboardPad, revealScroll } = mod;

// The owner's phone, Rider "Personal Details" (screenshot a326, 400 dp wide):
// the form runs from 150 to 866 dp, Gboard with its suggestion bar starts at
// 560, and the Email box (label to box bottom) is at 486-560.
const phone = { viewTop: 150, viewBottom: 866, keyboardTop: 560 };

test('the rule: 16 dp above the keyboard, 20 dp kept for the error line, 8 dp under the top', () => {
  assert.equal(FIELD_GAP, 16);
  assert.equal(ERROR_LINE, 20);
  assert.equal(TOP_GAP, 8);
});

test('the form gets room at its end for what the keyboard covers', () => {
  assert.equal(keyboardPad({ viewBottom: 866, keyboardTop: 560 }), 306);
  // a phone whose window shrank for the keyboard: no room added
  assert.equal(keyboardPad({ viewBottom: 540, keyboardTop: 560 }), 0);
  // no keyboard (hidden), or a measure that failed: nothing
  assert.equal(keyboardPad({ viewBottom: 866, keyboardTop: undefined }), 0);
  assert.equal(keyboardPad({ viewBottom: NaN, keyboardTop: 560 }), 0);
});

test("the owner's case: the Email box touching the suggestion bar is lifted with its error line", () => {
  const blockBottom = 560 + ERROR_LINE;
  const next = revealScroll({
    ...phone,
    scrollY: 0,
    blockTop: 486,
    blockBottom,
  });
  // its error line now ends 16 dp above the keyboard
  assert.equal(next, blockBottom - (560 - FIELD_GAP));
  assert.equal(blockBottom - next, 560 - FIELD_GAP);
});

test('a field hidden under the keyboard is brought up (the Passenger Edit profile Email)', () => {
  const next = revealScroll({
    ...phone,
    scrollY: 40,
    blockTop: 700,
    blockBottom: 790,
  });
  assert.equal(next, 40 + (790 - (560 - 16)));
});

test('a field already in view does not move the page', () => {
  assert.equal(
    revealScroll({ ...phone, scrollY: 120, blockTop: 300, blockBottom: 400 }),
    null,
  );
  // exactly at the line counts as in view
  assert.equal(
    revealScroll({ ...phone, scrollY: 0, blockTop: 400, blockBottom: 544 }),
    null,
  );
});

test('a field above the top of the form (scrolled past) comes down to 8 dp under it', () => {
  assert.equal(
    revealScroll({ ...phone, scrollY: 300, blockTop: 100, blockBottom: 180 }),
    300 - (158 - 100),
  );
});

test('a block taller than what is left keeps its label at the top', () => {
  // a long address at 1.3x: 450 dp of block, 386 dp of room
  assert.equal(
    revealScroll({ ...phone, scrollY: 200, blockTop: 400, blockBottom: 850 }),
    200 + (400 - 158),
  );
  // already there: no move
  assert.equal(
    revealScroll({ ...phone, scrollY: 200, blockTop: 158, blockBottom: 608 }),
    null,
  );
});

test('with the keyboard down only the form frame counts', () => {
  assert.equal(
    revealScroll({
      ...phone,
      keyboardTop: null,
      scrollY: 0,
      blockTop: 700,
      blockBottom: 780,
    }),
    null,
  );
  assert.equal(
    revealScroll({
      ...phone,
      keyboardTop: null,
      scrollY: 0,
      blockTop: 800,
      blockBottom: 900,
    }),
    900 - (866 - 16),
  );
});

test('never scrolls above the start, and gives up on a failed measure', () => {
  assert.equal(
    revealScroll({ ...phone, scrollY: 10, blockTop: 100, blockBottom: 180 }),
    0,
  );
  assert.equal(
    revealScroll({
      ...phone,
      scrollY: 0,
      blockTop: undefined,
      blockBottom: 700,
    }),
    null,
  );
});
