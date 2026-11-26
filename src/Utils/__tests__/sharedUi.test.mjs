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
  // the colour tokens' contrast and the dark look, in both apps (A-184 piece a)
  'src/Utils/__tests__/tokens.test.mjs',
  'src/Utils/__tests__/darkMode.test.mjs',
  'src/Components/AppButton/AppButton.js',
  'src/Components/AlertBox/AlertBox.js',
  'src/Components/AppTextInput/AppTextInput.js',
  'src/Components/OTP/OTPInput.js',
  // the code boxes are one field (QA SIN-08, 2026-11-25)
  'src/Utils/codeBoxes.js',
  'src/Utils/__tests__/codeBoxes.test.mjs',
  'src/Components/Container/Container.js',
  'src/Components/ConsentCheck/ConsentCheck.js',
  'src/Components/CodeChannelPicker/CodeChannelPicker.js',
  'src/Components/Menu/Menu.js',
  'src/Components/SettingRow/SettingRow.js',
  'src/Components/ThemeSwitch/ThemeSwitch.js',
  'src/Contexts/ThemeContext.js',
  'src/Screens/TermsScreen/TAC.js',
  'src/Components/EmergencyButton.js',
  'src/Components/EmergencyCall/emergencyCall.js',
  'src/Components/SafetyGuide/SafetyGuideModal.js',
  'src/Utils/__tests__/emergencyHelp.test.mjs',
  'src/Utils/alertShape.js',
  'src/Utils/appAlert.js',
  'src/Utils/alertQueue.js',
  'src/Utils/__tests__/alertQueue.test.mjs',
  'src/Components/AlertBox/AlertHost.js',
  'src/Utils/__tests__/alertShape.test.mjs',
  'src/Utils/__tests__/alertsInOneLook.test.mjs',
  // a busy box's 15-second error state (A-184 piece b)
  'src/Utils/busyTimeout.js',
  'src/Utils/__tests__/busyTimeout.test.mjs',
  'src/Components/ProfileAvatar/ProfileAvatar.js',
  'src/Components/GenderChoice/GenderChoice.js',
  'src/Utils/gender.js',
  'src/Utils/__tests__/gender.test.mjs',
  'src/Components/ChatThread/ChatThread.js',
  'src/Components/TripActions/TripActions.js',
  'src/Hooks/useAutoClose.js',
  // a box closes by itself only after time on screen (QA NTF-10)
  'src/Utils/onScreenTimer.js',
  'src/Utils/__tests__/onScreenTimer.test.mjs',
  'src/Utils/arrivalText.js',
  'src/Utils/closedRoad.js',
  'src/Utils/__tests__/closedRoad.test.mjs',
  'src/Utils/__tests__/arrivalText.test.mjs',
  'src/Utils/personName.js',
  'src/Utils/cashOut.js',
  'src/Screens/WalletScreen/CashOutScreen.js',
  'src/Utils/__tests__/cashOut.test.mjs',
  // the cash-out result page follows the cash-out (2026-11-24)
  'src/Hooks/useCashOutResult.js',
  'src/Utils/__tests__/sameVersion.test.mjs',
  'src/Utils/serverDown.js',
  'src/Utils/__tests__/serverDown.test.mjs',
  'src/Screens/Login/UpdateRequiredScreen.js',
  // its words (A-184, C-4)
  'src/Utils/updateNeededText.js',
  'src/Utils/__tests__/updateNeeded.test.mjs',
  // the version as people see it, 2.0.103 as 2.1.04 (the owner, 2026-11-25)
  'src/Utils/displayVersion.js',
  'src/Utils/__tests__/displayVersion.test.mjs',
  // the silent sign-in token swap (security finding F-2 part 2, 2026-11-25)
  'src/Utils/sessionSwap.js',
  'src/Utils/__tests__/sessionSwap.test.mjs',
  // Android's versionName is the shown version: it is sent back as the real one (2026-11-25)
  'src/Utils/installedVersion.js',
  'src/Utils/codeChannel.js',
  'src/Utils/accountDeletion.js',
  'src/Utils/bottomSpace.js',
  'src/Utils/handedCode.js',
  'src/Utils/updateWhenReady.js',
  'src/Utils/appRestart.js',
  'src/Services/useUpdateWhenReady.js',
  'src/Utils/__tests__/updateWhenReady.test.mjs',
  'src/Utils/__tests__/sharedUi.test.mjs',
  'src/Utils/paymentWait.js',
  // release builds keep console.log out of the system log
  'src/Utils/quietLogs.js',
  'src/Utils/__tests__/paymentWait.test.mjs',
  // the other party's number on Booking Details (KI-63, 2026-11-25)
  'src/Utils/bookingContact.js',
  'src/Utils/__tests__/bookingContact.test.mjs',
  // crash summaries for the API: error type and place in the code only (A-211)
  'src/Utils/crashSummary.js',
  'src/Services/crashReporter.js',
  'src/Utils/__tests__/crashSummary.test.mjs',
  // the support contact: Help & support and Contact support (Q-WALLET-TEXT)
  'src/Utils/supportContact.js',
  'src/Utils/__tests__/supportContact.test.mjs',
  // the payment-done picture (AppTransactionComplete)
  'src/Assets/Common/Success_Image.png',
  // the iOS project's config plugins (npx expo prebuild --platform ios)
  'plugins/withFirebaseConfigure.js',
  'plugins/withPodsForXcode27.js',
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const other = join(
  root,
  '..',
  basename(root) === 'Rider-MobileApp'
    ? 'Passenger-MobileApp'
    : 'Rider-MobileApp',
);
const skip = existsSync(other)
  ? false
  : 'the other app is not next to this one';

// Pictures are compared byte for byte; text as text, so a failure shows the lines.
const PICTURE = /\.(png|jpe?g|webp|gif)$/i;

for (const file of SHARED) {
  test(`${file} is the same in both apps`, { skip }, () => {
    assert.ok(
      existsSync(join(other, file)),
      `${file} is missing in ${basename(other)}`,
    );
    if (PICTURE.test(file)) {
      assert.ok(
        readFileSync(join(root, file)).equals(readFileSync(join(other, file))),
        `${file} differs between the apps: copy it to ${basename(other)}`,
      );
      return;
    }
    assert.equal(
      readFileSync(join(root, file), 'utf8'),
      readFileSync(join(other, file), 'utf8'),
      `${file} differs between the apps: copy the change to ${basename(other)}`,
    );
  });
}
