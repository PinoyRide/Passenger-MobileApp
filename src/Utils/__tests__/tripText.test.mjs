import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../tripText.js';
const { tripLengthText, distanceText, tripChipText, fareNoteText } = mod;

test('a trip length in minutes and hours', () => {
  assert.equal(tripLengthText(28), '28 min');
  assert.equal(tripLengthText(60), '1 hr');
  assert.equal(tripLengthText(75), '1 hr 15 min');
  assert.equal(tripLengthText(0), '');
  assert.equal(tripLengthText(null), '');
});

test('a distance to one decimal under 10 km', () => {
  assert.equal(distanceText(5.4), '5.4 km');
  assert.equal(distanceText('0.8'), '0.8 km');
  assert.equal(distanceText(12.3), '12 km');
  assert.equal(distanceText(null), '');
  assert.equal(distanceText(0), '');
});

test('the map chip says how long and how far, leaving out what is unknown', () => {
  assert.equal(tripChipText({ minutes: 12, km: 5.4 }), '12 min · 5.4 km');
  assert.equal(tripChipText({ minutes: null, km: 5.4 }), '5.4 km');
  assert.equal(tripChipText({}), '');
});

test('the fare notes say only what the answer shows', () => {
  assert.equal(fareNoteText({ booking_fee: 10, traffic_surcharge_amount: 0 }), 'Incl. booking fee · no surge');
  assert.equal(fareNoteText({ booking_fee: 0, traffic_surcharge_amount: 0 }), 'No surge');
  assert.equal(fareNoteText({ booking_fee: 10, traffic_surcharge_amount: 12.5 }), 'Incl. booking fee');
  // an answer without the surcharge field claims nothing about it
  assert.equal(fareNoteText({ booking_fee: 10 }), 'Incl. booking fee');
  assert.equal(fareNoteText(null), '');
});
