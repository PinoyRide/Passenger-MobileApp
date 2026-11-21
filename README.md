### BUILD GRADLE

# debug

cd android && ./gradlew clean && ./gradlew assembleDebug && cd ..

# release

cd android && ./gradlew clean && ./gradlew assembleRelease && cd ..

### RELEASE BUILD REACT-NATIVE

# android

npx react-native run-android --variant=release

# ios

npx react-native run-ios --configuration Release

# Fix android build for AAPT error

aaptOptions {
cruncherEnabled = false
}

### SELF-UPDATES

An installed app (2.0.1 and later) asks the Pinoy Ride backend for newer JavaScript and images every time it
starts. When an update arrives within 3 seconds the app opens on it straight away; one that takes longer is
used the next time the app is started. Nothing is installed again.

- What travels: `src/`, the images and the fonts. What does not: `android/`, `ios/`, and a package added,
  removed or changed in `package.json`. Those need a new version number and a new APK.
- How a change gets out: land it in `Develop`. Render packs the update (`npm run update:pack`) and the Develop
  backend hands it, signed, to the installed apps of the same version within a few minutes.
- The guard: `bump-version.js` records a checksum of the native part in `native-signature.json`. When
  `android/` or a package changes, the pack step fails saying so (the phones keep what they have) and
  `npm test` fails, until the version is bumped: `node bump-version.js <next version> --code+`.
- An update that cannot start: the app goes back to the one before it by itself, and is not sent that update
  again. To take an update back for everyone, revert the commit in `Develop`: the pack of the reverted code
  is a newer update.
- Which update a phone runs: the landing screen shows it after the version. `v2.0.1 · Develop · 3fa9c1e` is
  the update built from commit `3fa9c1e`; no commit means the code the APK came with.
- A phone picks an update up when the app starts, not when it comes back from the background: swipe it away
  from the recent apps and open it again.
- Where it is set: `android/app/src/main/AndroidManifest.xml` (the address, the certificate, how long a start
  waits). The app's own code only shows the label (`src/Utils/selfUpdate.js`), and does not restart the app
  to pick an update up sooner: that file says why. The backend's README ("App updates") describes its side.
- iOS is not set up for it: `ios/pinoyride/Supporting/Expo.plist` keeps it off.
