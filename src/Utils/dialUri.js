// The tel: address for a Philippine mobile number, in the international form
// (+63…), whatever spelling the API sent. The trip's rider number comes as
// "63" + ten digits (ekyc_details.pretty_mobile_no): dialled as it is, without
// the "+", a Philippine network takes it for a local number and the call does
// not go through (QA TRP-06, 2026-11-25). The Rider app dials "+" + the same
// field; Booking Details already gets a ready dial_uri from the API.

const dialUri = number => {
  const raw = String(number ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  if (raw.startsWith('+')) {
    return `tel:+${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('63')) {
    return `tel:+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('09')) {
    return `tel:+63${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return `tel:+63${digits}`;
  }
  return `tel:${digits}`;
};

module.exports = { dialUri };
