// How far the rider is, as the "Rider found" banner says it on its right
// (the owner's design, 2026-11-23, frame "8 · Rider found": "3 min away"):
// "3 min away", "Arriving now", "At the pick-up", or '' when it is not known
// (no ETA yet, or the last one is over 90 s old). Pure (no RN imports) so it
// runs under `node --test`.

// as Hooks/riderEta.js: an ETA older than this is not shown
const STALE_MS = 90000;

function riderAwayText(riderEta, receivedAt, now = Date.now()) {
  if (!riderEta) {
    return '';
  }
  if (riderEta.state === 'arrived') {
    return 'At the pick-up';
  }
  if (!receivedAt || now - receivedAt > STALE_MS) {
    return '';
  }
  if (riderEta.state === 'arriving_now') {
    return 'Arriving now';
  }
  const raw = riderEta.eta_minutes ?? riderEta.minutes;
  const minutes = raw == null || raw === '' ? NaN : Number(raw);
  if (riderEta.state === 'en_route' && Number.isFinite(minutes)) {
    return minutes < 1 ? 'Arriving now' : `${Math.round(minutes)} min away`;
  }
  return '';
}

module.exports = { riderAwayText, STALE_MS };
