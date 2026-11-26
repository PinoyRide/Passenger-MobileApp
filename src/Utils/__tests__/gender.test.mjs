import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../gender.js';

const { GENDERS, genderOf } = mod;

// The owner, 2026-11-23: "Require gender so we can display in profile also
// having a badge".
test('two answers, as the backend stores them', () => {
  assert.deepEqual(
    GENDERS.map(gender => gender.value),
    ['female', 'male'],
  );
});

test('what the account holds, read in any case', () => {
  assert.equal(genderOf('female').label, 'Female');
  assert.equal(genderOf(' MALE ').label, 'Male');
  assert.equal(genderOf('male').icon, 'gender-male');
  assert.equal(genderOf('other'), null);
  assert.equal(genderOf(null), null);
  assert.equal(genderOf(''), null);
});
