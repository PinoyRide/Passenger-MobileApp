import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../placeSearch.js';

// The decisions of a place search, the same in both apps (A-328).
const { PAUSE_MS, planSearch, resultStatus } = mod;

test('it asks 300 ms after the last key', () => {
  assert.equal(PAUSE_MS, 300);
});

test('blank asks nothing and clears the list', () => {
  for (const typed of ['', '   ', null, undefined]) {
    assert.equal(planSearch({ typed }), 'clear', String(typed));
  }
});

test("the Passenger's search, unchanged: one letter asks, with no limit", () => {
  assert.equal(planSearch({ typed: 'a' }), 'ask');
  assert.equal(planSearch({ typed: ' a ' }), 'ask');
  assert.equal(planSearch({ typed: 'makati', callsMade: 500 }), 'ask');
});

test("the Rider's home address waits for the 3rd letter", () => {
  assert.equal(planSearch({ typed: 'a', minLength: 3 }), 'wait');
  assert.equal(planSearch({ typed: 'ab', minLength: 3 }), 'wait');
  assert.equal(planSearch({ typed: ' ab  ', minLength: 3 }), 'wait', 'spaces are not letters');
  assert.equal(planSearch({ typed: 'abc', minLength: 3 }), 'ask');
});

test('the 10 calls of a visit: the 10th is asked, the 11th is not', () => {
  const rider = { typed: 'rizal st', minLength: 3, maxCalls: 10 };
  assert.equal(planSearch({ ...rider, callsMade: 9 }), 'ask');
  assert.equal(planSearch({ ...rider, callsMade: 10 }), 'capped');
  assert.equal(planSearch({ ...rider, callsMade: 11 }), 'capped');
  // too few letters or blank is not a call, so it is not "used up"
  assert.equal(planSearch({ ...rider, typed: 'ri', callsMade: 10 }), 'wait');
  assert.equal(planSearch({ ...rider, typed: '', callsMade: 10 }), 'clear');
});

test('a failed request is not "no results" (B4)', () => {
  assert.equal(resultStatus({ failed: true, list: [] }), 'failed');
  assert.equal(resultStatus({ failed: true }), 'failed');
  assert.equal(resultStatus({ failed: false, list: [] }), 'empty');
  assert.equal(resultStatus({ failed: false }), 'empty');
  assert.equal(resultStatus({ failed: false, list: [{ place_id: 'p1' }] }), 'results');
});
