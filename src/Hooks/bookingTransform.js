export const getBookingTypeLabel = type => {
  const types = { 1: 'Motorcycle', 2: 'Car', 3: 'Car' };
  return types[type] || 'Ride';
};

export const getBookingTypeImage = type => {
  const images = {
    1: require('@/Assets/Common/HomeScreen/Motorcycle.png'),
    2: require('@/Assets/Common/HomeScreen/Car.png'),
    3: require('@/Assets/Common/HomeScreen/Car.png'),
  };
  return images[type] || require('@/Assets/Common/HomeScreen/Motorcycle.png');
};

export const getStatusLabel = status => {
  const statuses = {
    0: 'Pending',
    1: 'Accepted',
    2: 'On the way',
    3: 'Completed',
    4: 'Cancelled',
    5: 'Scheduled',
  };
  return statuses[status] || 'Unknown';
};

export const getRawStatus = booking =>
  Number(booking?.raw_status ?? booking?.status);

export const hasAssignedRider = booking =>
  Boolean(booking?.rider_assigned) ||
  Boolean(booking?.rider_details && Object.keys(booking.rider_details).length);

// Accepted (or started) Book Later rows show Figma's "Advance Booking" chip.
export const isAcceptedAdvanceBooking = booking => {
  if (!booking?.is_advance) {
    return false;
  }
  const status = getRawStatus(booking);
  if (![1, 2, 5].includes(status)) {
    return false;
  }
  return status !== 5 || hasAssignedRider(booking);
};

// Live map + trip sheet only after the rider taps "Go to Pick up Location" (start_advance → status 1/2).
export const isAdvanceOnLiveTripMap = booking =>
  Boolean(booking?.is_advance) && [1, 2].includes(getRawStatus(booking));

// Advance bookings already show the accepted-rider modal at status 5; skip "We found you a Rider!" at status 1.
export const shouldShowRiderFoundAlert = booking => !booking?.is_advance;

export const isReturnedToPool = booking =>
  Boolean(booking?.returned_to_pool_at) &&
  getRawStatus(booking) === 5 &&
  !hasAssignedRider(booking);

export const getAssignedRiderId = (booking, riderDetails) =>
  riderDetails?.id ?? booking?.rider_id ?? booking?.rider_details?.id ?? null;

/** One acknowledgment per rider assignment (re-show modal after pool reassignment). */
export const advanceAcceptedAckKey = (bookingId, riderId) => {
  if (bookingId == null || riderId == null) {
    return null;
  }
  return `${bookingId}:${riderId}`;
};

export const isAdvanceAcceptedAcknowledged = (ackIds, bookingId, riderId) => {
  if (!bookingId || !riderId || !Array.isArray(ackIds)) {
    return false;
  }
  const key = advanceAcceptedAckKey(bookingId, riderId);
  const idStr = String(bookingId);
  return (
    ackIds.includes(key) || ackIds.includes(bookingId) || ackIds.includes(idStr)
  );
};

export const getDisplayStatus = booking => {
  if (isReturnedToPool(booking)) {
    return 'Returned to pool';
  }
  if (isAcceptedAdvanceBooking(booking)) {
    return 'Advance Booking';
  }
  return booking.pretty_status || getStatusLabel(getRawStatus(booking));
};

export const getHistoryBadgeColor = (status, colors) => {
  const s = String(status || '');
  if (s === 'Completed') {
    return colors.completed;
  }
  if (/^cancel/i.test(s)) {
    return colors.cancelled;
  }
  if (
    s === 'Advance Booking' ||
    s === 'Accepted' ||
    s === 'On the way' ||
    s === 'Trip Started'
  ) {
    return colors.blue;
  }
  if (s === 'Returned to pool' || /^returned/i.test(s)) {
    return colors.blue;
  }
  if (s === 'Scheduled' || s === 'Pending') {
    return '#FFA726';
  }
  return colors.cancelled;
};

export const canRebookHistory = status => {
  const s = String(status || '');
  return s === 'Completed' || /^cancel/i.test(s);
};

export const canCancelAdvanceBooking = booking =>
  Boolean(booking?.is_advance) && [0, 1, 2, 5].includes(getRawStatus(booking));

// Figma 8:16677 header: "28 May 2025 | 01:42 PM"
export const formatDetailsDateTime = value => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value || '');
  }
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const pad = n => String(n).padStart(2, '0');
  const h = d.getHours() % 12 || 12;
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  return `${pad(d.getDate())} ${
    months[d.getMonth()]
  } ${d.getFullYear()} | ${pad(h)}:${pad(d.getMinutes())} ${ampm}`;
};

export const capitalizeFirst = str => {
  if (!str) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const getRiderName = riderDetails => {
  if (!riderDetails || Object.keys(riderDetails).length === 0) {
    return 'No rider assigned';
  }

  const { first_name = '', middle_name = '', last_name = '' } = riderDetails;
  let fullName = `${first_name} ${middle_name} ${last_name}`.trim();

  // Fall back to eKYC name if the top-level rider name fields are blank
  if (!fullName && riderDetails.ekyc_details) {
    const {
      first_name: ekycFirst = '',
      middle_name: ekycMiddle = '',
      last_name: ekycLast = '',
    } = riderDetails.ekyc_details;
    fullName = `${ekycFirst} ${ekycMiddle} ${ekycLast}`.trim();
  }

  return fullName || 'Unknown Rider';
};

// "2026-10-12T18:08:55+08:00" -> "2026-10-12 - 06:08 PM" (same style as
// date_created - time_created), in the device's local time.
const formatScheduledPickup = value => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value);
  }
  const pad = n => String(n).padStart(2, '0');
  const h = d.getHours() % 12 || 12;
  const ampm = d.getHours() < 12 ? 'AM' : 'PM';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )} - ${pad(h)}:${pad(d.getMinutes())} ${ampm}`;
};

export const transformBooking = booking => {
  const raw_status = Number.isFinite(Number(booking.raw_status))
    ? Number(booking.raw_status)
    : Number(booking.status);
  const mapped = {
    ...booking,
    raw_status,
    title: getBookingTypeLabel(booking.booking_type),
    image: getBookingTypeImage(booking.booking_type),
    destination: booking.dropoff_location,
    pickup: booking.pickup_location,
    date:
      booking.is_advance && booking.scheduled_pickup_at
        ? formatScheduledPickup(booking.scheduled_pickup_at)
        : `${booking.date_created} - ${booking.time_created}`,
    detailsDate:
      booking.is_advance && booking.scheduled_pickup_at
        ? formatDetailsDateTime(booking.scheduled_pickup_at)
        : null,
    price: booking.payment_details?.total_amount?.toFixed(2) || '0.00',
    bookingId: booking.ref_code,
    paymentMethod: capitalizeFirst(booking.payment_type),
    riderName: getRiderName(booking.rider_details),
    riderRating: booking.booking_ratings?.rate
      ? parseFloat(booking.booking_ratings.rate)
      : null,
  };
  mapped.status = getDisplayStatus(mapped);
  return mapped;
};

// Rider photo: eKYC selfie first, then legacy top-level selfie fields.
export const getRiderPhoto = rd =>
  rd?.ekyc_details?.selfie ||
  rd?.selfie ||
  rd?.selfie_pretty ||
  rd?.profile_img_pretty ||
  null;

// Identity that survives a DB reset: ids restart, so pair the id with the
// server's creation stamp. Used for locally remembered accepted/rated/stale ids.
export const bookingKey = b =>
  b && b.id != null
    ? `${b.id}|${b.date_created || ''} ${b.time_created || ''}`.trim()
    : '';
