// The words of the page after a trip (Screens/RatingScreen), drawn from the
// owner's design (2026-11-23, "make this"). Pure (no RN imports) so it runs
// under `node --test`.

// What each number of stars means, said under them once chosen.
const RATING_WORDS = ['', 'Bad', 'Poor', 'Okay', 'Good', 'Great'];

// A place's first part: "Makati Square".
const placeName = text =>
  String(text || '')
    .split(',')[0]
    .trim();

// A distance as the apps say it: "450 m", "2.4 km", "5 km".
const distanceText = meters => {
  const rounded = Math.round(meters);
  return rounded < 1000
    ? `${rounded} m`
    : `${(meters / 1000).toFixed(1).replace(/\.0$/, '')} km`;
};

// The page's question: "How was your ride with Jomar?"
const rideQuestion = firstName =>
  firstName ? `How was your ride with ${firstName}?` : 'How was your ride?';

// When the trip ended away from its drop-off (the rider confirmed it there,
// over 300 m away): what the page says, and what a report starts with. null
// when the trip ended where it should.
const endedAwayNotice = booking => {
  const meters = Number(booking?.end_distance_m);
  if (!booking?.ended_away || !Number.isFinite(meters)) {
    return null;
  }
  const distance = distanceText(meters);
  return {
    title: `Your trip ended ${distance} from your drop-off`,
    body: "If that isn't right, the fare can be reviewed.",
    report: `My trip ended ${distance} from my drop-off.`,
  };
};

// The tags under the stars follow the score (the owner's design, 2026-11-23:
// "'Add a compliment' assumed the trip went well. Tags now follow the score:
// praise at 4-5, problems at 1-3"). The question above them, and the tags.
const PRAISE = [
  'Safe driving',
  'Friendly',
  'On time',
  'Clean vehicle',
  'Knew the way',
];
const PROBLEMS = [
  'Unsafe driving',
  'Late',
  'Rude',
  'Took a long way',
  'Vehicle condition',
];
const tagsFor = rating =>
  rating >= 4
    ? { ask: 'What went well?', tags: PRAISE }
    : rating >= 1
    ? { ask: 'What went wrong?', tags: PROBLEMS }
    : { ask: '', tags: [] };

// What is sent as the rating's words: the tags picked, then the note.
// "Safe driving, Friendly. Thank you!"
const feedbackText = (tags, note) =>
  [(tags || []).join(', '), String(note || '').trim()]
    .filter(Boolean)
    .join('. ');

// Submit waits for a star, and for the last send to finish.
const canSubmit = (rating, sending) =>
  Number.isInteger(rating) && rating >= 1 && rating <= 5 && !sending;

module.exports = {
  RATING_WORDS,
  placeName,
  distanceText,
  rideQuestion,
  endedAwayNotice,
  canSubmit,
  tagsFor,
  feedbackText,
};
