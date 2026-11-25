// The "Booking update" box that tells the passenger their rider cancelled
// and the trip is booked again under a new reference (the old booking:
// status 4 with replaced_by, the new one: replaced_by_ref_code).
//
// Until 2026-11-25 (QA LAT-16) only Home's own poll of the booking on screen
// raised it, in a box drawn by Home. A scheduled ride the passenger had
// closed on Home ("parked") is watched by the parked poll instead, and that
// poll dropped the cancelled booking without a word: the passenger learnt of
// it only when the re-offered ride was accepted and Home was opened again.
// Both polls now ask for this box through appAlert, which AlertHost draws
// over whatever screen is open (Booking Details, History, ...).
//
// Pure (no RN imports) so it runs under `node --test`.

const rawStatus = booking => Number(booking?.raw_status ?? booking?.status);

// The rider cancel re-pooled this booking: { oldId, newId, newRefCode },
// else null (a booking the passenger cancelled, or one that expired, has no
// replaced_by).
function riderCancelReplacement(booking) {
  if (
    booking?.id == null ||
    !booking?.replaced_by ||
    rawStatus(booking) !== 4
  ) {
    return null;
  }
  return {
    oldId: booking.id,
    newId: booking.replaced_by,
    newRefCode: booking.replaced_by_ref_code || null,
  };
}

// The box for it, or null. `key` keeps one box per cancelled booking while it
// is shown or waiting (both polls may see the same cancel).
function riderCancelAlert(booking) {
  const replacement = riderCancelReplacement(booking);
  if (!replacement) {
    return null;
  }
  // not_set_off: the rider never tapped "Go to Pick Up Location" and the trip
  // was passed on (backend InstantRelease)
  const message =
    (booking.not_set_off
      ? "Your rider didn't respond. We're finding you a new rider."
      : "Your rider cancelled. We're finding you a new rider.") +
    (replacement.newRefCode ? ` New reference: ${replacement.newRefCode}` : '');
  return {
    title: 'Booking update',
    message,
    key: `rider-cancel-${replacement.oldId}`,
  };
}

module.exports = { riderCancelReplacement, riderCancelAlert };
