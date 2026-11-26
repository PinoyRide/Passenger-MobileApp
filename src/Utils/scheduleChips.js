// The date and time chips of the scheduling sheet (PickDateModal). Pure (no
// RN imports) so it runs under `node --test`. Times are the phone's local
// time; the caller passes `now` already corrected to the server's clock.
//
// docs/booking-redesign-spec.md, "Advance booking": the chips are built from
// now plus the minimum lead, never from now; the first chip reads Today only
// while a valid slot is left today; times go in 15-minute steps from the
// first valid slot; a chosen slot that drifts inside the lead while the sheet
// is open is greyed out rather than hidden.

const STEP_MINUTES = 15;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const startOfDay = ms => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const addDays = (ms, days) => {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
};

const sameDay = (a, b) => startOfDay(a) === startOfDay(b);

// The next 15-minute step at or after `ms`, in local time.
function ceilToStep(ms) {
  const d = new Date(ms);
  const onStep =
    d.getMinutes() % STEP_MINUTES === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0;
  if (onStep) {
    return d.getTime();
  }
  d.setSeconds(0, 0);
  d.setMinutes(
    Math.floor(d.getMinutes() / STEP_MINUTES) * STEP_MINUTES + STEP_MINUTES,
  );
  return d.getTime();
}

const floorToStep = ms => {
  const d = new Date(ms);
  d.setSeconds(0, 0);
  d.setMinutes(Math.floor(d.getMinutes() / STEP_MINUTES) * STEP_MINUTES);
  return d.getTime();
};

// The earliest slot that may be booked, and the latest moment.
const earliestSlot = ({ now, minLeadMinutes }) =>
  ceilToStep(now + minLeadMinutes * MINUTE);
const latestMoment = ({ now, maxWindowDays }) => now + maxWindowDays * DAY;

// The time picked when the sheet opens: the code's default (now plus the
// lead plus 5 minutes), moved onto the grid's next step.
const firstPick = ({ now, minLeadMinutes }) =>
  ceilToStep(now + (minLeadMinutes + 5) * MINUTE);

// "2:30 PM", as formatScheduledTimeLabel says it.
function formatTime(ms) {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

// "Fri 28 Nov".
function dayText(ms) {
  const d = new Date(ms);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

// Four days from the first one with a valid slot, never past the window:
// [{ day, label: 'Today' | 'Mon', date: 23, month: 'Nov' }].
function dateChips({ now, minLeadMinutes, maxWindowDays, count = 4 }) {
  const first = startOfDay(earliestSlot({ now, minLeadMinutes }));
  const latest = latestMoment({ now, maxWindowDays });
  const today = startOfDay(now);
  const chips = [];
  for (let i = 0; i < count; i += 1) {
    const day = addDays(first, i);
    if (day > latest) {
      break;
    }
    const d = new Date(day);
    chips.push({
      day,
      label: day === today ? 'Today' : DAY_NAMES[d.getDay()],
      date: d.getDate(),
      month: MONTH_NAMES[d.getMonth()],
    });
  }
  return chips;
}

// Eight 15-minute slots on `day`: from the first valid slot on the first
// valid day (or from the picked slot, if it has drifted before it), from the
// hour of the picked time on a later day. Slots past the day are left out;
// slots too soon or past the window are `disabled` (greyed out).
function timeSlots({
  day,
  picked,
  now,
  minLeadMinutes,
  maxWindowDays,
  count = 8,
}) {
  const earliest = earliestSlot({ now, minLeadMinutes });
  const latest = latestMoment({ now, maxWindowDays });
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const pickedHere = picked != null && sameDay(picked, dayStart);

  let start;
  if (earliest >= dayStart && earliest < dayEnd) {
    start = pickedHere ? Math.min(earliest, floorToStep(picked)) : earliest;
  } else {
    const d = new Date(dayStart);
    const from = new Date(picked != null ? picked : earliest);
    d.setHours(from.getHours(), 0, 0, 0);
    start = d.getTime();
  }

  const slots = [];
  for (let i = 0; i < count; i += 1) {
    const at = start + i * STEP_MINUTES * MINUTE;
    if (at >= dayEnd) {
      break;
    }
    slots.push({
      at,
      label: formatTime(at),
      disabled: at < earliest || at > latest,
    });
  }
  return slots;
}

// The picked time of day carried to another day; the day's first valid slot
// when that would be too soon.
function pickOnDay({ day, picked, now, minLeadMinutes }) {
  const d = new Date(startOfDay(day));
  const from = new Date(picked);
  d.setHours(from.getHours(), from.getMinutes(), 0, 0);
  const earliest = earliestSlot({ now, minLeadMinutes });
  return d.getTime() < earliest ? earliest : d.getTime();
}

// The button's words: "today, 2:30 PM", "tomorrow, 9:00 AM", "Fri 28 Nov, 2:30 PM".
function scheduleLabel({ picked, now }) {
  let when = dayText(picked);
  if (sameDay(picked, now)) {
    when = 'today';
  } else if (sameDay(picked, addDays(now, 1))) {
    when = 'tomorrow';
  }
  return `${when}, ${formatTime(picked)}`;
}

module.exports = {
  ceilToStep,
  dateChips,
  dayText,
  firstPick,
  formatTime,
  pickOnDay,
  sameDay,
  scheduleLabel,
  startOfDay,
  timeSlots,
};
