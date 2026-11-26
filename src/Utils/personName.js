// A person's name and number as the account pages show them.

const upFirst = part => part.charAt(0).toUpperCase() + part.slice(1);

// One part of a word (between hyphens): capitals the person typed inside it
// stay (DeGuzman, McArthur); a part with no small letter at all (DELA, JOHN)
// is shouted, so it becomes Dela, John. A one-letter start before an
// apostrophe takes a capital after it too (O'Neil, D'Souza), nothing else
// does (Mary's).
const capitalisePart = part => {
  const shouted =
    part === part.toUpperCase() && part !== part.toLowerCase();
  const text = shouted ? part.toLowerCase() : part;
  const m = /^(\p{L})(['\u2019])(\p{L}.*)$/u.exec(text);
  return m ? `${upFirst(m[1])}${m[2]}${upFirst(m[3])}` : upFirst(text);
};

// A word with a capital after every hyphen: "cruz-villanueva" ->
// "Cruz-Villanueva".
const capitalise = word => word.split('-').map(capitalisePart).join('-');

// "JOHN roe" -> "John Roe"; "Dela Cruz-villanueva" -> "Dela Cruz-Villanueva";
// "DeGuzman" and "McArthur" stay as typed.
export const titleCase = text =>
  String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalise)
    .join(' ');

// The person's first and last name: a passenger's from the identity check
// when there is one, else from the profile (fname, lname); a rider's from
// their account (first_name, last_name). '' when there is no name.
export const fullNameOf = user =>
  [
    titleCase(
      user?.ekyc_details?.first_name || user?.fname || user?.first_name,
    ),
    titleCase(user?.ekyc_details?.last_name || user?.lname || user?.last_name),
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
