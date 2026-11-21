# Google Play release checklist (Passenger app)

Status as of 2026-11-20. Applies to `com.pinoyride.customer`.

## Covered in the app

| Requirement | How it is met |
|---|---|
| Target API level 36 (Android 16): required for new apps and updates since 31 Aug 2026 | Expo SDK 54 / React Native 0.81; compile and target SDK 36 |
| 16 KB memory page support: required for apps targeting Android 15+ | RN 0.81 native libraries; uncompressed, 16 KB-aligned packaging (`expo.useLegacyPackaging=false`). Check each build (below) |
| 64-bit | arm64-v8a and x86_64 are built |
| Permissions limited to what the app uses | Foreground location, camera, notifications only. Background location, storage, overlay and microphone are removed (`tools:node="remove"`), as is expo-location's unused background location service |
| Permissions requested in context | Location on onboarding (core feature); camera only when taking the selfie or ID photo |
| In-app account deletion | Settings → Delete Account (Django `POST /api/customers/delete_account/`; .NET `DELETE /api/customers/{id}`) |
| Edge to edge (enforced at target 36) | Screens use safe-area insets; dark status bar icons (`StatusBar style="dark"`, `windowLightStatusBar`) |
| No unused third-party SDKs | Facebook SDK and Google Sign-In removed (they collected data and had no screen using them) |
| Signing keys out of the repo | Release signing comes from EAS, or locally from `PINOYRIDE_UPLOAD_*` in `~/.gradle/gradle.properties` |

## To do in Play Console (not code)

- **Data safety form.** Declare:
  - precise and approximate location, collected while the app is in use
  - name and phone number
  - photos (selfie and ID, for identity verification)
  - payment and transaction history
  - device push token
  - Firebase (Messaging) as a data processor

  Declare that data is encrypted in transit, and that users can request deletion.
- **Account deletion URL.** Play also requires a public web page where users can request deletion without the app. Host one (for example on PRTCWeb) and enter its URL.
- **Privacy policy URL.** It must match the Data safety answers.
- **Upload key.** `my-release-key.keystore` was committed to git on 2025-08-22. If it is (or was) the Play upload key, request an upload key reset in Play Console and store the new key only in EAS.
- **Content rating and target audience** questionnaires, if this is the first release under this listing.

## Verify a build before uploading

```bash
cd android
./gradlew bundleRelease assembleRelease
BT=$ANDROID_HOME/build-tools/36.0.0
$BT/aapt2 dump badging app/build/outputs/apk/release/*.apk | grep -E "targetSdkVersion|uses-permission"
$BT/zipalign -c -P 16 -v 4 app/build/outputs/apk/release/*.apk | tail -1   # "Verification successful"
```

Building needs JDK 17 (the Gradle 8.14 in this project cannot run on Java 25 or later).

## Known follow-ups

- **Next target API rule.** Expo SDK 54 is the last SDK that allows the legacy architecture (`newArchEnabled=false`). Play's next yearly rule (expected Aug 2027) will need a newer SDK. To prepare, replace `react-native-geolocation-service` (unmaintained), `react-native-network-info` and `react-native-simple-crypto`, which are not New Architecture ready.
- **iOS.** Run `cd ios && pod install`. The Podfile still mentions `react-native-fbsdk-next`, and `NSCameraUsageDescription` is still the placeholder `[REASON]`.
