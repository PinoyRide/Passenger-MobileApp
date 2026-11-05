// Status 2 banner text only — keep the existing UI, append arrival clock.
// Arrival = now + eta_minutes, shown as "12:15 PM". Uses booking/get_eta.
// Once a drop-off ETA has appeared, keep it until a newer valid one arrives
// or the ride ends — never hide it for staleness or a failed poll.
const IN_TRANSIT = 'In transit';

const isDropoffEta = eta =>
  Boolean(eta && eta.state && (!eta.leg || eta.leg === 'dropoff'));

const keepDropoffEta = (prev, incoming) =>
  isDropoffEta(incoming) ? incoming : prev;

const formatArrivalClock = (etaMinutes, now = Date.now()) => {
  if (!Number.isFinite(etaMinutes)) {
    return null;
  }
  const at = new Date(now + Math.max(0, etaMinutes) * 60 * 1000);
  let hours = at.getHours();
  const minutes = at.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) {
    hours = 12;
  }
  const mm = String(minutes).padStart(2, '0');
  return `${hours}:${mm} ${ampm}`;
};

const formatEtaPart = (dropoffEta, now) => {
  const { state, pretty } = dropoffEta;
  const rawMinutes = dropoffEta.eta_minutes ?? dropoffEta.minutes;
  const minutes = rawMinutes == null ? NaN : Number(rawMinutes);

  if (state === 'arriving_now') {
    return 'Arriving now';
  }
  if (state === 'en_route' && Number.isFinite(minutes)) {
    if (minutes < 1) {
      return 'Arriving now';
    }
    return formatArrivalClock(minutes, now);
  }
  if (state === 'en_route' && typeof pretty === 'string' && pretty.trim()) {
    // Prefer a clock when pretty embeds minutes; otherwise show pretty stripped.
    const match = pretty.match(/(\d+)\s*mins?/i);
    if (match) {
      return formatArrivalClock(Number(match[1]), now);
    }
    return pretty.replace(/^Arriving in\s+/i, '').trim() || null;
  }
  return null;
};

// receivedAt kept in the signature for call-site compatibility; ignored.
const getDropoffEtaText = (dropoffEta, _receivedAt, now = Date.now()) => {
  if (!isDropoffEta(dropoffEta)) {
    return IN_TRANSIT;
  }
  const part = formatEtaPart(dropoffEta, now);
  return part
    ? part === 'Arriving now'
      ? `${IN_TRANSIT} · ${part}`
      : `${IN_TRANSIT} · ETA ${part}`
    : IN_TRANSIT;
};

module.exports = {
  IN_TRANSIT,
  isDropoffEta,
  keepDropoffEta,
  formatArrivalClock,
  getDropoffEtaText,
};
