import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../scheduleChips.js';
const { ceilToStep, dateChips, firstPick, formatTime, pickOnDay, scheduleLabel, timeSlots } = mod;

// local times: Sunday 22 Nov 2026
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime();
const rules = { minLeadMinutes: 120, maxWindowDays: 30 };

test('times go in 15-minute steps', () => {
  assert.equal(ceilToStep(at(22, 14, 7)), at(22, 14, 15));
  assert.equal(ceilToStep(at(22, 14, 15)), at(22, 14, 15));
  assert.equal(ceilToStep(at(22, 14, 52)), at(22, 15, 0));
  assert.equal(formatTime(at(22, 14, 30)), '2:30 PM');
  assert.equal(formatTime(at(22, 0, 15)), '12:15 AM');
  assert.equal(formatTime(at(22, 12, 0)), '12:00 PM');
});

test('the sheet opens on now plus the lead plus 5 minutes, on the grid', () => {
  // 12:07 + 2 h + 5 min = 2:12 PM, next step 2:15 PM
  assert.equal(firstPick({ now: at(22, 12, 7), minLeadMinutes: 120 }), at(22, 14, 15));
});

test('the first chip reads Today only while a valid slot is left today', () => {
  const morning = dateChips({ now: at(22, 9, 0), ...rules });
  assert.deepEqual(
    morning.map(c => `${c.label} ${c.date} ${c.month}`),
    ['Today 22 Nov', 'Mon 23 Nov', 'Tue 24 Nov', 'Wed 25 Nov'],
  );
  // 10:30 PM + 2 h is tomorrow: the row starts there
  const late = dateChips({ now: at(22, 22, 30), ...rules });
  assert.equal(late[0].label, 'Mon');
  assert.equal(late[0].date, 23);
});

test('no chip goes past the booking window', () => {
  const chips = dateChips({ now: at(22, 9, 0), minLeadMinutes: 120, maxWindowDays: 1 });
  assert.deepEqual(chips.map(c => c.date), [22, 23]);
});

test('today’s slots start at the first valid one', () => {
  const slots = timeSlots({ day: at(22, 0), picked: at(22, 14, 30), now: at(22, 12, 0), ...rules });
  assert.deepEqual(
    slots.map(s => s.label),
    ['2:00 PM', '2:15 PM', '2:30 PM', '2:45 PM', '3:00 PM', '3:15 PM', '3:30 PM', '3:45 PM'],
  );
  assert.ok(slots.every(s => !s.disabled));
});

test('a later day’s slots start at the hour of the picked time', () => {
  const slots = timeSlots({ day: at(23, 0), picked: at(23, 14, 30), now: at(22, 12, 0), ...rules });
  assert.equal(slots[0].label, '2:00 PM');
  assert.equal(slots.length, 8);
  // late at night the grid stops at midnight
  const late = timeSlots({ day: at(23, 0), picked: at(23, 23, 15), now: at(22, 12, 0), ...rules });
  assert.deepEqual(late.map(s => s.label), ['11:00 PM', '11:15 PM', '11:30 PM', '11:45 PM']);
});

test('a picked slot that drifts inside the lead stays on the grid, greyed out', () => {
  // picked 2:00 PM; it is now 12:01, so 2:00 PM is too soon
  const slots = timeSlots({ day: at(22, 0), picked: at(22, 14, 0), now: at(22, 12, 1), ...rules });
  assert.equal(slots[0].label, '2:00 PM');
  assert.equal(slots[0].disabled, true);
  assert.equal(slots[1].label, '2:15 PM');
  assert.equal(slots[1].disabled, false);
});

test('moving to another day keeps the time of day, unless it is too soon there', () => {
  const now = at(22, 12, 0);
  assert.equal(pickOnDay({ day: at(24, 0), picked: at(22, 14, 30), now, ...rules }), at(24, 14, 30));
  // 9:00 AM today is too soon: the first valid slot instead
  assert.equal(pickOnDay({ day: at(22, 0), picked: at(23, 9, 0), now, ...rules }), at(22, 14, 0));
});

test('the button says when, in words', () => {
  const now = at(22, 12, 0);
  assert.equal(scheduleLabel({ picked: at(22, 14, 30), now }), 'today, 2:30 PM');
  assert.equal(scheduleLabel({ picked: at(23, 9, 0), now }), 'tomorrow, 9:00 AM');
  assert.equal(scheduleLabel({ picked: at(27, 14, 30), now }), 'Fri 27 Nov, 2:30 PM');
});
