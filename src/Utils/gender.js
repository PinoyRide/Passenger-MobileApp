// A passenger's gender (the owner, 2026-11-23: "Require gender so we can
// display in profile also having a badge"): the two answers the forms offer,
// as the backend stores them, how the profile says them, and the icon of the
// badge on the photo. Pure (no RN imports) so it runs under `node --test`.

const GENDERS = [
  { value: 'female', label: 'Female', icon: 'gender-female' },
  { value: 'male', label: 'Male', icon: 'gender-male' },
];

// The answer for what the account holds ("female", "Male", ...), or null.
const genderOf = value =>
  GENDERS.find(
    gender =>
      gender.value ===
      String(value || '')
        .trim()
        .toLowerCase(),
  ) || null;

module.exports = { GENDERS, genderOf };
