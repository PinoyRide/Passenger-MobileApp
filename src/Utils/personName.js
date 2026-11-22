// A person's name and number as the account pages show them.

const capitalise = word =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

// "JOHN roe" -> "John Roe"
export const titleCase = text =>
  String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalise)
    .join(' ');

// The passenger's first and last name, from the identity check when there is
// one, else from the profile. '' when neither has a name.
export const fullNameOf = user =>
  [
    titleCase(user?.ekyc_details?.first_name || user?.fname),
    titleCase(user?.ekyc_details?.last_name || user?.lname),
  ]
    .filter(Boolean)
    .join(' ');

// "John Roe Dannug" -> "JD": the first and the last word's first letters.
export const initialsOf = name => {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${words[0][0]}${last}`.toUpperCase();
};

// "+63 917 000 0000", as both apps show a number: +63 takes the place of the
// leading 0, never both. Stored as 639XXXXXXXXX; older rows hold 09XXXXXXXXX.
// '' when there is no number; the text as it was when it is not a mobile
// number.
export const displayMobile = mobile => {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  let local = digits;
  if (local.startsWith('63')) {
    local = local.slice(2);
  } else if (local.startsWith('0')) {
    local = local.slice(1);
  }
  if (local.length !== 10) {
    return String(mobile);
  }
  return `+63 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
};
