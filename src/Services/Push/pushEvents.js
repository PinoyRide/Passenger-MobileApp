import { DeviceEventEmitter } from 'react-native';

// Shared payload (both apps): data{type, booking_id, is_advance, status,
// eta_minutes}. FCM sends every data value as a string.
export const PUSH_TYPES = {
  RIDER_ACCEPTED: 'rider_accepted',
  RIDER_HEADING: 'rider_heading',
  RIDER_ARRIVED: 'rider_arrived',
  TRIP_STARTED: 'trip_started',
  TRIP_COMPLETED: 'trip_completed',
  RIDER_CANCELLED_REASSIGNING: 'rider_cancelled_reassigning',
  ADVANCE_ACCEPTED: 'advance_accepted',
  // status 4 with cancelled_by='system'
  ADVANCE_EXPIRED: 'advance_expired',
};

const KNOWN_TYPES = Object.values(PUSH_TYPES);

// Home listens for this to refresh booking state right away instead of
// waiting for the next poll.
export const PUSH_BOOKING_UPDATE_EVENT = 'pinoyride.push.bookingUpdate';

export function parsePushData(raw) {
  const data = raw || {};
  const bookingId = data.booking_id ? Number(data.booking_id) : null;
  const eta =
    data.eta_minutes === '' || data.eta_minutes == null
      ? null
      : Number(data.eta_minutes);
  return {
    type: KNOWN_TYPES.includes(data.type) ? data.type : null,
    bookingId: Number.isFinite(bookingId) ? bookingId : null,
    isAdvance:
      data.is_advance === true ||
      data.is_advance === '1' ||
      data.is_advance === 'true',
    status:
      data.status === '' || data.status == null ? null : Number(data.status),
    etaMinutes: Number.isFinite(eta) ? eta : null,
    // extra fields from the shared sender (only when known)
    riderName: data.rider_name || null,
    vehicle: data.vehicle || null,
    plate: data.plate || data.plate_number || null,
    scheduledDate: data.scheduled_date || data.pickup_date || null,
    scheduledTime: data.scheduled_time || data.pickup_time || null,
  };
}

// In-app banner text. Adds the US-1.3 driver details and the US-1.4 booking
// date/time from the extra payload fields when the body doesn't already
// include them.
export function formatPushBody(body, parsed) {
  const text = body || '';
  const missing = parts => parts.filter(Boolean).filter(p => !text.includes(p));
  let extra = [];
  if (parsed?.type === PUSH_TYPES.RIDER_ARRIVED) {
    extra = missing([parsed.riderName, parsed.vehicle, parsed.plate]);
  } else if (parsed?.type === PUSH_TYPES.RIDER_CANCELLED_REASSIGNING) {
    extra = missing([parsed.scheduledDate, parsed.scheduledTime]);
  }
  if (!extra.length) {
    return text;
  }
  return text ? `${text}\n${extra.join(' · ')}` : extra.join(' · ');
}

export function emitBookingUpdate(parsed) {
  DeviceEventEmitter.emit(PUSH_BOOKING_UPDATE_EVENT, parsed);
}

// Where a tapped notification should land. Returns null for unknown types.
export function getPushRoute(parsed) {
  if (!parsed?.type) {
    return null;
  }
  switch (parsed.type) {
    case PUSH_TYPES.TRIP_COMPLETED:
    case PUSH_TYPES.ADVANCE_EXPIRED:
      // History loads the booking and opens its details (US-1.6).
      return {
        name: 'BookingHistoryScreen',
        params: parsed.bookingId ? { openBookingId: parsed.bookingId } : {},
      };
    case PUSH_TYPES.ADVANCE_ACCEPTED:
    case PUSH_TYPES.RIDER_CANCELLED_REASSIGNING:
      return {
        name: 'HomeScreen',
        params:
          parsed.isAdvance && parsed.bookingId
            ? { expandAdvanceBookingId: parsed.bookingId }
            : {},
      };
    default:
      // live trip events: Home restores the active booking on focus
      return { name: 'HomeScreen', params: {} };
  }
}
