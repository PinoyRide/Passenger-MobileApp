import { DeviceEventEmitter } from 'react-native';
import { walletRoute } from '@/Utils/cashOut';
import { walletOff } from '@/Utils/walletOff';

// Shared payload (both apps): data{type, booking_id, is_advance, status,
// eta_minutes}. FCM sends every data value as a string.
export const PUSH_TYPES = {
  RIDER_ACCEPTED: 'rider_accepted',
  RIDER_HEADING: 'rider_heading',
  // the owner, 2026-11-24: "should be notified when rider is 10 minutes
  // away": once per trip, when the rider comes within 10 minutes
  RIDER_NEARBY: 'rider_nearby',
  RIDER_ARRIVED: 'rider_arrived',
  TRIP_STARTED: 'trip_started',
  TRIP_COMPLETED: 'trip_completed',
  RIDER_CANCELLED_REASSIGNING: 'rider_cancelled_reassigning',
  ADVANCE_ACCEPTED: 'advance_accepted',
  // status 4 with cancelled_by='system'
  ADVANCE_EXPIRED: 'advance_expired',
  // the owner, 2026-11-24: "is our app notifies even when minimized or
  // closed": a chat message from the rider, and money in or out
  CHAT_MESSAGE: 'chat_message',
  WALLET_CREDITED: 'wallet_credited',
  CASH_OUT_PAID: 'cash_out_paid',
  CASH_OUT_FAILED: 'cash_out_failed',
  // a scheduled ride in 1 hour / 5 minutes, and an instant search that
  // ended with no rider (both open Home on that booking)
  ADVANCE_REMINDER: 'advance_reminder',
  NO_RIDER_FOUND: 'no_rider_found',
};

const WALLET_TYPES = [
  PUSH_TYPES.WALLET_CREDITED,
  PUSH_TYPES.CASH_OUT_PAID,
  PUSH_TYPES.CASH_OUT_FAILED,
];

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
// The payload is only a hint: the target screen always reloads the booking by
// id (get_details) and decides from its current status (see HomeScreen's
// push-target handling and BookingHistoryScreen's openBookingId).
export function getPushRoute(parsed) {
  if (!parsed?.type) {
    return null;
  }
  // money in or out: the wallet (no booking), with a fresh stamp so a
  // Wallet already open reads again (WAL-11); Home in the Google Play build,
  // which has no wallet screen (Utils/walletOff.js)
  if (WALLET_TYPES.includes(parsed.type)) {
    return walletOff() ? { name: 'HomeScreen', params: {} } : walletRoute();
  }
  const id = parsed.bookingId;
  if (!id) {
    // no booking to open: safe fallback
    return { name: 'HomeScreen', params: {} };
  }
  switch (parsed.type) {
    case PUSH_TYPES.CHAT_MESSAGE:
      // the trip's chat (it loads the names itself)
      return { name: 'ChatScreen', params: { bookingId: id } };
    case PUSH_TYPES.ADVANCE_EXPIRED:
      // Booking Details (cancelled) via History, fetched by id if it isn't on
      // page 1 (US-1.6).
      return {
        name: 'BookingHistoryScreen',
        params: { openBookingId: id, fromPush: true },
      };
    case PUSH_TYPES.ADVANCE_ACCEPTED:
    case PUSH_TYPES.RIDER_CANCELLED_REASSIGNING:
      // unchanged: Home expands that advance booking's card
      return {
        name: 'HomeScreen',
        params: parsed.isAdvance
          ? {
              expandAdvanceBookingId: id,
              fromPush: true,
              pushType: parsed.type,
            }
          : {},
      };
    case PUSH_TYPES.RIDER_ACCEPTED:
    case PUSH_TYPES.RIDER_HEADING:
    case PUSH_TYPES.RIDER_NEARBY:
    case PUSH_TYPES.RIDER_ARRIVED:
    case PUSH_TYPES.TRIP_STARTED:
    case PUSH_TYPES.TRIP_COMPLETED:
    default:
      // Home restores that booking's live trip by id (expanding a minimized or
      // parked advance booking). trip_completed: Rating if not rated yet,
      // otherwise Booking Details.
      return {
        name: 'HomeScreen',
        params: {
          expandAdvanceBookingId: id,
          fromPush: true,
          pushType: parsed.type,
        },
      };
  }
}
