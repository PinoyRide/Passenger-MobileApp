/**
 * Resolves the vehicle shown on live booking / tracking UI.
 * Priority: booking snapshot → rider's current vehicle → first vehicle (legacy).
 */
export const getBookingVehicle = (booking, riderDetails) => {
  const fromBooking = booking?.vehicle;
  if (fromBooking?.plate_number || fromBooking?.brand || fromBooking?.model) {
    return mapVehicle(fromBooking);
  }

  const vehicles = riderDetails?.vehicle_details;
  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    return null;
  }

  const current = vehicles.find(v => v.is_current);
  const chosen = current || vehicles[0];
  return mapVehicle(chosen);
};

const mapVehicle = raw => {
  if (!raw) {
    return null;
  }
  const brand = raw.brand || '';
  const model = raw.model || '';
  const color = raw.color || '';
  const labelParts = [brand, model].filter(Boolean);
  let label = labelParts.join(' ');
  if (color) {
    label = label ? `${label} · ${color}` : color;
  }
  return {
    plateNumber: raw.plate_number || '',
    brand,
    model,
    color,
    type: raw.type,
    label,
  };
};
