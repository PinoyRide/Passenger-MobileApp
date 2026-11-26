// What Home does when a minimized ("parked") advance booking turns out to be
// under way: the rider tapped "Go to Pick Up Location" (status 1) or started
// the trip (status 2) while the passenger was on Home with the booking tucked
// away. Until 2026-11-25 (QA LAT-13) nothing brought it back: the parked poll
// only refreshed its snapshot and the upcoming-booking discovery skipped
// minimized ids, so the trip sheet showed only after a restart.
//
//   'expand'  nothing is on screen: show the trip from the parked snapshot
//   'replace' a different booking that is not live (a scheduled one) is on
//             screen: the trip under way takes its place
//   'same'    this booking is already on screen: just forget the parked copy
//   null      not under way, or another live trip is on screen (it stays;
//             the passenger reaches this one from Booking History or a push)
//
// "Live on screen" is the same test as Home's openPushTarget. Pure (no RN
// imports) so it runs under `node --test`.

function parkedGoesLive(booking, { activeBooking, bookingStatus } = {}) {
  const status = Number(booking?.status);
  if (booking?.id == null || (status !== 1 && status !== 2)) {
    return null;
  }
  if (activeBooking?.id == null) {
    return 'expand';
  }
  if (String(activeBooking.id) === String(booking.id)) {
    return 'same';
  }
  const shown = Number(bookingStatus);
  const liveOnScreen =
    shown === 1 || shown === 2 || (!activeBooking.is_advance && shown === 0);
  return liveOnScreen ? null : 'replace';
}

module.exports = { parkedGoesLive };
