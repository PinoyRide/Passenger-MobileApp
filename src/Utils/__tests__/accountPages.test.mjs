import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');

// The owner, 2026-11-23, of the Profile page: "check why it is N/A even when
// we have it". It read the email, gender and address of the old TOP PH
// identity check, which the API never sends, so they said N/A for everyone.
test('the Profile page shows the email the account holds', () => {
  const profile = read('src/Screens/Profile/ProfileScreen.js');
  assert.match(profile, /userInfo\?\.email/);
  assert.doesNotMatch(profile, /email_address|current_address|ekyc\?\.gender/);
  assert.doesNotMatch(profile, /label: '(Gender|Address)'/);
});

// The owner, 2026-11-23: "redundunt logout button, retain the one in
// settings". Log out is in Settings only, as in the Rider app.
test('Log out is in Settings, not on the Account page', () => {
  assert.doesNotMatch(
    read('src/Screens/SettingsScreen/SettingsScreen.js'),
    /useLogOut|confirmLogOut/,
  );
  assert.match(
    read('src/Screens/SettingsScreen/AccountSettingsScreen.js'),
    /title="Log out"[\s\S]*onPress=\{confirmLogOut\}/,
  );
});
