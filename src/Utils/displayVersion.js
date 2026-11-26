// The version as people see it, from the real one (the owner, 2026-11-25,
// option B). The owner counts versions 2.0.99 → 2.1.01 → 2.1.02: a patch of
// two digits, 01 to 99, after which the middle number goes up by one and the
// patch starts again at 01. "2.1.01" is not a valid version number (semver
// forbids the leading zero), so the real version keeps counting as before
// (2.0.100, 2.0.101, …) in package.json, app.json, iOS, the self-updates
// (runtime version) and everything sent to the API; only what people see is
// mapped here: the screens, and since 2026-11-25 Android's versionName, which
// Google Play and App info show (the owner: "versionName must equal the shown
// version"; scripts/version-places.js writes it). Pure (no RN imports) so it
// runs under `node --test`. The same file in both apps (sharedUi.test.mjs).
//
// major.minor.p, with p the real patch:
//   p <= 99   major.minor.<p as two digits>        2.0.5 → 2.0.05, 2.0.99 → 2.0.99
//   p >= 100  major.(minor + ⌊(p−1)/99⌋).<((p−1) mod 99) + 1 as two digits>
//             2.0.100 → 2.1.01, 2.0.103 → 2.1.04, 2.0.198 → 2.1.99, 2.0.199 → 2.2.01
// The major number never changes. Anything that is not three whole numbers
// (missing, "2.0", "2.0.103-beta", words) comes back as it was given.
const REAL = /^(\d+)\.(\d+)\.(\d+)$/;

function displayVersion(real) {
  if (typeof real !== 'string') {
    return real;
  }
  const parts = REAL.exec(real);
  if (!parts) {
    return real;
  }
  const [major, minor, patch] = parts.slice(1).map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) {
    return real;
  }
  const carry = patch >= 100 ? Math.floor((patch - 1) / 99) : 0;
  const shown = patch >= 100 ? ((patch - 1) % 99) + 1 : patch;
  return `${major}.${minor + carry}.${String(shown).padStart(2, '0')}`;
}

// The other way, for the one shown version the app reads back: Android's
// versionName, as react-native-device-info reads it (installedVersion.js).
// The API's build check and its minimum versions, the sign-in's
// last_app_version and the download folder's file names all count real
// versions, so a versionName of 2.1.12 is sent as 2.0.111. The real
// version is major.0.N (bump-version.js refuses any other), so the way back
// is exact: major.m.PP → major.0.(m × 99 + PP), kept only when it shows as
// the name given. Everything else comes back as it was given: a real version
// (2.0.106, the versionName of every APK built before 2026-11-25), a version
// of one digit or three (2.0.5, 2.0.106), anything that is not a version.
const SHOWN = /^(\d+)\.(\d+)\.(\d{2})$/;

function realVersion(name) {
  if (typeof name !== 'string') {
    return name;
  }
  const parts = SHOWN.exec(name);
  if (!parts) {
    return name;
  }
  const [major, minor, patch] = parts.slice(1).map(Number);
  if (![major, minor, minor * 99 + patch].every(Number.isSafeInteger)) {
    return name;
  }
  const real = `${major}.0.${minor * 99 + patch}`;
  return displayVersion(real) === name ? real : name;
}

module.exports = { displayVersion, realVersion };
