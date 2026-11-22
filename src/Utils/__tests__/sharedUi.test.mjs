import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The owner, 2026-11-22: "rider and passenger should share the same UI style
// so next time i wont be repeating it again". These are the two apps' shared
// building blocks, kept as the same file in Passenger-MobileApp and
// Rider-MobileApp: a change to one is copied to the other in the same change.
// A new building block both apps use goes on this list. Checked when the other
// app sits next to this one (PRTC-WBM/mobileapps); skipped where it does not
// (Render packs one app at a time).
const SHARED = [
  'src/Theme/modern.js',
  'src/Components/AppButton/AppButton.js',
  'src/Components/AlertBox/AlertBox.js',
  'src/Components/AppTextInput/AppTextInput.js',
  'src/Components/OTP/OTPInput.js',
  'src/Components/Container/Container.js',
  'src/Components/ConsentCheck/ConsentCheck.js',
  'src/Components/CodeChannelPicker/CodeChannelPicker.js',
  'src/Components/Menu/Menu.js',
  'src/Utils/codeChannel.js',
  'src/Utils/accountDeletion.js',
  'src/Utils/bottomSpace.js',
  'src/Utils/handedCode.js',
  'src/Utils/updateWhenReady.js',
  'src/Utils/appRestart.js',
  'src/Services/useUpdateWhenReady.js',
  'src/Utils/__tests__/updateWhenReady.test.mjs',
  'src/Utils/__tests__/sharedUi.test.mjs',
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const other = join(
  root,
  '..',
  basename(root) === 'Rider-MobileApp'
    ? 'Passenger-MobileApp'
    : 'Rider-MobileApp',
);
const skip = existsSync(other) ? false : 'the other app is not next to this one';

for (const file of SHARED) {
  test(`${file} is the same in both apps`, { skip }, () => {
    assert.ok(existsSync(join(other, file)), `${file} is missing in ${basename(other)}`);
    assert.equal(
      readFileSync(join(root, file), 'utf8'),
      readFileSync(join(other, file), 'utf8'),
      `${file} differs between the apps: copy the change to ${basename(other)}`,
    );
  });
}
