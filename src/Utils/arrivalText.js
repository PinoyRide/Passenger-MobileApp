// The line under a trip's headline, the same in both apps (the owner,
// 2026-11-23: "make it cleaner and the ETA"): "Arriving at 4:10 AM · 15 min",
// "Arriving now", or '' when it is not known. `state` is the server's ETA
// state (booking/get_eta: en_route, arriving_now), `minutes` the minutes to
// go. The clock is built by hand so it does not depend on the phone's Intl.
// Pure (no RN imports) so it runs under `node --test`.

const clock = date => {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
};

// "15 min", "1 hr", "1 hr 5 min"
const duration = minutes => {
  const n = Math.max(1, Math.round(minutes));
  if (n < 60) {
    return `${n} min`;
  }
  const hours = Math.floor(n / 60);
  const rest = n % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
};

function arrivalText(state, minutes, now = Date.now()) {
  if (state === 'arriving_now') {
    return 'Arriving now';
  }
  const n = minutes == null || minutes === '' ? NaN : Number(minutes);
  if (state !== 'en_route' || !Number.isFinite(n)) {
    return '';
  }
  if (n < 1) {
    return 'Arriving now';
  }
  const from = now instanceof Date ? now.getTime() : Number(now);
  const at = new Date(from + Math.round(n) * 60000);
  return `Arriving at ${clock(at)} · ${duration(n)}`;
}

module.exports = { arrivalText };
