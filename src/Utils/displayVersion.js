// The version as people see it, from the real one (the owner, 2026-11-25,
// option B). The owner counts versions 2.0.99 → 2.1.01 → 2.1.02: a patch of
// two digits, 01 to 99, after which the middle number goes up by one and the
// patch starts again at 01. "2.1.01" is not a valid version number (semver
// forbids the leading zero), so the real version keeps counting as before
// (2.0.100, 2.0.101, …) in package.json, app.json, Android's versionName, the
// self-updates and everything sent to the API; only what a screen shows is
// mapped here. Pure (no RN imports) so it runs under `node --test`. The same
// file in both apps (sharedUi.test.mjs).
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

module.exports = { displayVersion };
