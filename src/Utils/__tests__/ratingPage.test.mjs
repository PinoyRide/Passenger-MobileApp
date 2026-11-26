import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../ratingPage.js';

const {
  RATING_WORDS,
  placeName,
  distanceText,
  rideQuestion,
  endedAwayNotice,
  canSubmit,
  tagsFor,
  feedbackText,
} = mod;

test('the question names the rider when the page knows them', () => {
  assert.equal(rideQuestion('Jomar'), 'How was your ride with Jomar?');
  assert.equal(rideQuestion(''), 'How was your ride?');
});

test('a place is said by its first part', () => {
  assert.equal(
    placeName(
      'Makati Square, GF Chino Roces Ave, Legazpi Village, Makati City, Metro Manila, Philippines',
    ),
    'Makati Square',
  );
  assert.equal(
    placeName('Pembo Taguig, Metro Manila, Philippines'),
    'Pembo Taguig',
  );
  assert.equal(placeName(undefined), '');
});

test('distances read as the apps say them', () => {
  assert.equal(distanceText(450), '450 m');
  assert.equal(distanceText(2440), '2.4 km');
  assert.equal(distanceText(4956), '5 km');
  // never "1000 m"
  assert.equal(distanceText(999.6), '1 km');
});

test('a trip that ended 5 km from its drop-off says so and can be reported', () => {
  // trip 57 on Develop: completed 4,956 m from the drop-off
  assert.deepEqual(
    endedAwayNotice({ ended_away: true, end_distance_m: 4956 }),
    {
      title: 'Your trip ended 5 km from your drop-off',
      body: "If that isn't right, the fare can be reviewed.",
      report: 'My trip ended 5 km from my drop-off.',
    },
  );
  assert.equal(
    endedAwayNotice({ ended_away: true, end_distance_m: '420' }).title,
    'Your trip ended 420 m from your drop-off',
  );
});

test('no notice for a trip that ended at its drop-off', () => {
  assert.equal(
    endedAwayNotice({ ended_away: false, end_distance_m: 20 }),
    null,
  );
  assert.equal(endedAwayNotice({ ended_away: true }), null);
  assert.equal(endedAwayNotice(undefined), null);
});

test('the tags follow the score: praise at 4-5, problems at 1-3', () => {
  assert.equal(tagsFor(5).ask, 'What went well?');
  assert.ok(tagsFor(4).tags.includes('Safe driving'));
  assert.equal(tagsFor(3).ask, 'What went wrong?');
  assert.ok(tagsFor(1).tags.includes('Late'));
  assert.deepEqual(tagsFor(0), { ask: '', tags: [] });
  // no tag is in both
  assert.equal(
    tagsFor(5).tags.filter(tag => tagsFor(2).tags.includes(tag)).length,
    0,
  );
});

test('the words sent: the tags picked, then the note', () => {
  assert.equal(
    feedbackText(['Safe driving', 'Friendly'], ' Thank you! '),
    'Safe driving, Friendly. Thank you!',
  );
  assert.equal(feedbackText([], 'Great ride'), 'Great ride');
  assert.equal(feedbackText(['Late'], ''), 'Late');
  assert.equal(feedbackText([], ''), '');
});

test('submit waits for a star and for the last send', () => {
  assert.equal(canSubmit(0, false), false);
  assert.equal(canSubmit(1, false), true);
  assert.equal(canSubmit(5, false), true);
  assert.equal(canSubmit(5, true), false);
  assert.equal(canSubmit(6, false), false);
  assert.equal(RATING_WORDS[5], 'Great');
  assert.equal(RATING_WORDS[0], '');
});
