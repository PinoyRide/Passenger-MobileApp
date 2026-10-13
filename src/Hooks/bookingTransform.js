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
  };
  return statuses[status] || 'Unknown';
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

export const transformBooking = booking => ({
  ...booking,
  title: getBookingTypeLabel(booking.booking_type),
  image: getBookingTypeImage(booking.booking_type),
  // An advance booking a rider already holds stays at status 5 until pickup;
  // label it Accepted rather than Scheduled.
  status:
    booking.is_advance &&
    Number(booking.status) === 5 &&
    (booking.rider_assigned ||
      (booking.rider_details && Object.keys(booking.rider_details).length))
      ? 'Accepted'
      : booking.pretty_status || getStatusLabel(booking.status),
  destination: booking.dropoff_location,
  pickup: booking.pickup_location,
  date:
    booking.is_advance && booking.scheduled_pickup_at
      ? formatScheduledPickup(booking.scheduled_pickup_at)
      : `${booking.date_created} - ${booking.time_created}`,
  price: booking.payment_details?.total_amount?.toFixed(2) || '0.00',
  bookingId: booking.ref_code,
  paymentMethod: capitalizeFirst(booking.payment_type),
  riderName: getRiderName(booking.rider_details),
  riderRating: booking.booking_ratings?.rate
    ? parseFloat(booking.booking_ratings.rate)
    : null,
});

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
