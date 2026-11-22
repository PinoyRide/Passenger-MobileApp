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

### VERSION AND BUILD NUMBER

Every change to the app gets a new version and a new build number, as a commit of its own that lands in
`Develop` together with the change:

```
node bump-version.js patch --code+     # 2.0.1 -> 2.0.2, build number + 1 (minor, major or a version also work)
node --test src/Utils/__tests__/       # fails if any file still says something else
```

The script says how that version reaches the phones: as a self-update, or only with a new APK.

### SELF-UPDATES

An installed app (2.0.1 and later) asks the Pinoy Ride backend for newer JavaScript and images every time it
starts, and the loading screen waits until the update is in: the app opens on the new code in one loading, and
nothing about updates shows once it is open (APKs from Passenger 2.0.14 and Rider 2.0.15; older ones wait 3 or
20 seconds). With no update the check takes a moment; with no internet it gives up at once; 2 minutes is a cap
for a connection that hangs, after which the update is used, without a word, at the next start. Nothing is
installed again.

- What travels: `src/`, the images and the fonts. What does not: `android/`, `ios/`, and a package added,
  removed or changed in `package.json`. Those need a new APK.
- How a change gets out: land it in `Develop`, with its version. Render packs the update
  (`npm run update:pack`) and the Develop backend hands it, signed, to the installed apps within a few
  minutes. The app's first screen then shows the new version.
- Two numbers. The version goes up with every change. The APK version (`native-signature.json`, and
  `expo_runtime_version` in the Android project) is the version at which the native part last changed. An
  installed app takes every update made for its APK version: an app installed as 2.0.1 goes on to run 2.0.2,
  2.0.3 and so on, until a change needs a new APK. Android's own "App info" keeps showing the version of the
  APK that was installed.
- The guard: `bump-version.js` keeps a checksum of the native part in `native-signature.json`. When
  `android/` or a package changed, it says that the new version needs a new APK and makes it the APK version;
  apps installed before then keep the last update made for them. A native change that was given no version
  makes the pack step and `npm test` fail.
- An update that cannot start: the app goes back to the one before it by itself, and is not sent that update
  again. To take an update back for everyone, revert the commit in `Develop`: the pack of the reverted code
  is a newer update.
- Which update a phone runs: the landing screen shows the version and the commit. `v2.0.2 · Develop · 3fa9c1e`
  is version 2.0.2 from commit `3fa9c1e`; no commit means the code the APK came with.
- A phone picks an update up when the app starts, not when it comes back from the background: swipe it away
  from the recent apps and open it again.
- What a person sees meanwhile (from the 2.0.5 APK): from the moment the app is opened until its first
  screen is ready, the logo, a moving line and one sentence: "Checking for updates…", "Downloading the
  update…" when one was found, then "Starting…". It is native (`LaunchScreen.kt`,
  `res/layout/launch_screen.xml`), because no JavaScript runs during that wait, and it looks like the app's
  own first screen (`SplashScreen.js`), which takes over from it without a jump. It leaves when the view
  `App.js` marks with `nativeID="app-ready"` is drawn. Changing how it looks needs a new APK.
- Nothing about updates shows once the app is open (the owner, 2026-11-22: "we should do it all on app
  start"). An update that did not arrive within the wait finishes in the background and is used at the next
  start.
- Where it is set: `android/app/src/main/AndroidManifest.xml` (the address, the certificate, how long a start
  waits). The app's own code only shows the label (`src/Utils/selfUpdate.js`), and does not restart the app
  to pick an update up sooner: that file says why. The backend's README ("App updates") describes its side.
- iOS is not set up for it: `ios/pinoyride/Supporting/Expo.plist` keeps it off.

### APP ICON

Gold, with the riders of the logo in black. The Driver app is the other way round (black, riders in gold), so
the two are told apart at a glance.

Every icon file (`android/app/src/main/res/mipmap-*`, and the iOS `AppIcon` set) is made from one drawing by
`PRTC-WBM/design/app-icons/make-icons.js`; nothing in those folders is edited by hand. The 512 px picture for a
store listing is written to `PRTC-WBM/design/app-icons/store/`. The icon is part of the native app: changing it
needs a new version and a new APK.
