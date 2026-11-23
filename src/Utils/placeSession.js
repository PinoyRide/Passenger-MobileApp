// Place search as one Google session (the owner, 2026-11-23: "reduce
// costing of the apps but be sure that our app will still give the best
// service"). The suggestions while typing cost nothing when the session ends
// with the one place picked (places/details); before, every search paid for
// a full lookup of each suggestion. Pure (no RN imports) so it runs under
// `node --test`.

// Google ends a session after a few minutes; a longer search starts afresh.
const SESSION_MAX_MS = 3 * 60 * 1000;

// A UUID v4, the token Google expects.
function newToken(random = Math.random) {
  const hex = n =>
    Array.from({ length: n }, () =>
      Math.floor(random() * 16).toString(16),
    ).join('');
  const variant = '89ab'[Math.floor(random() * 4)];
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

// The session to search in: the current one while it is fresh, else a new one.
function sessionFor(current, now, random) {
  return current && now - current.startedAt < SESSION_MAX_MS
    ? current
    : { token: newToken(random), startedAt: now };
}

// "lat,lng" of a point ({ lat, long }), or '' when it has none: Google then
// says how far each suggestion is from it, as the list shows.
function nearOf(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.long);
  return point?.lat != null &&
    point?.long != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
    ? `${lat},${lng}`
    : '';
}

// places/autocomplete's answer as the list's items (no coordinates yet).
function suggestionsFrom(list) {
  return (Array.isArray(list) ? list : [])
    .filter(p => p && p.placeId)
    .map(p => ({
      display_name: p.displayName,
      description: p.description,
      address: p.address,
      place_id: p.placeId,
      distance_km:
        p.distanceMeters != null && Number.isFinite(Number(p.distanceMeters))
          ? Number(p.distanceMeters) / 1000
          : null,
    }));
}

// The picked suggestion with its location from places/details, or null.
function placeFrom(details, suggestion) {
  const lat = Number(details?.lat);
  const long = Number(details?.long);
  if (!details || !Number.isFinite(lat) || !Number.isFinite(long)) {
    return null;
  }
  return {
    ...suggestion,
    display_name: suggestion?.display_name || details.displayName,
    address: suggestion?.address || details.address,
    description: suggestion?.description || details.description,
    place_id: details.placeId || suggestion?.place_id,
    lat,
    long,
  };
}

// A picked place as one line to save (Add Saved Place): its name, then its
// address unless the address already starts with it.
// "Makati Square, GF Chino Roces Ave, Makati City"
function placeLine(place) {
  const name = String(place?.display_name || '').trim();
  const address = String(place?.address || place?.description || '').trim();
  if (!name) {
    return address;
  }
  if (!address || address.toLowerCase().startsWith(name.toLowerCase())) {
    return address || name;
  }
  return `${name}, ${address}`;
}

// How far a suggestion is, as the list says it: "450 m", "2.4 km", or ''.
function distanceLabel(km) {
  const value = Number(km);
  if (km == null || km === '' || !Number.isFinite(value) || value < 0) {
    return '';
  }
  return value < 1
    ? `${Math.round(value * 1000)} m`
    : `${value.toFixed(1).replace(/\.0$/, '')} km`;
}

module.exports = {
  placeLine,
  distanceLabel,
  SESSION_MAX_MS,
  newToken,
  sessionFor,
  nearOf,
  suggestionsFrom,
  placeFrom,
};
