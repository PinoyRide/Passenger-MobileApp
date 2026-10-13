export const RIDER_ETA_STALE_MS = 90000;

const FALLBACK_UNAVAILABLE = 'Rider location unavailable';

/**
 * Banner text for status 1 when rider_eta is present; null keeps the default message.
 */
export const getRiderEtaText = (riderEta, receivedAt, now = Date.now()) => {
  if (!riderEta) {
    return null;
  }

  if (!receivedAt || now - receivedAt > RIDER_ETA_STALE_MS) {
    return FALLBACK_UNAVAILABLE;
  }

  const { state, pretty } = riderEta;
  const rawMinutes = riderEta.eta_minutes ?? riderEta.minutes;
  const minutes = rawMinutes == null ? NaN : Number(rawMinutes);

  if (state === 'arrived') {
    return 'Your Rider has arrived';
  }

  if (state === 'en_route' && Number.isFinite(minutes)) {
    if (minutes < 1) {
      return 'Arriving now';
    }
    const n = Math.round(minutes);
    return `Your Rider will arrive in ${n} ${n === 1 ? 'min' : 'mins'}`;
  }

  if (state === 'en_route' && pretty) {
    return `Your Rider will arrive in ${pretty}`;
  }

  if (state === 'not_started') {
    return null;
  }

  if (state === 'arriving_now') {
    return 'Arriving now';
  }

  return FALLBACK_UNAVAILABLE;
};
