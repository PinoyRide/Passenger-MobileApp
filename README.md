### BUILD GRADLE

# debug

cd android && ./gradlew clean && ./gradlew assembleDebug && cd ..

# release

cd android && ./gradlew clean && ./gradlew assembleRelease && cd ..

### RELEASE BUILD REACT-NATIVE

# android

npx react-native run-android --variant=release

# ios

See IOS below.

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
- An open app takes an update too (APKs from Passenger 2.0.22 and Rider 2.0.23; the owner, 2026-11-22). While
  it is on screen it asks every two minutes, and at once when it comes back to the screen; it downloads what it
  is offered and restarts itself into it right away, through the same loading screen as any start. It waits
  while a restart would cut something off: a booking under way or being placed, a booking request on the
  rider's screen, a payment, or a screen with something half done (a sign-in code already texted, a form or the
  application, a photo or ID check, a place being picked for a booking). It never restarts in the background.
  Older APKs take an update when the app starts: swipe it away from the recent apps and open it again.
- What a person sees meanwhile (from the 2.0.5 APK): from the moment the app is opened until its first
  screen is ready, the logo, a moving line and one sentence: "Checking for updates…", "Downloading the
  update…" when one was found, then "Starting…". It is native (`LaunchScreen.kt`,
  `res/layout/launch_screen.xml`), because no JavaScript runs during that wait, and it looks like the app's
  own first screen (`SplashScreen.js`), which takes over from it without a jump. It leaves when the view
  `App.js` marks with `nativeID="app-ready"` is drawn. Changing how it looks needs a new APK.
- Nothing about updates shows once the app is open (the owner, 2026-11-22: "we should do it all on app
  start"). An update that did not arrive within the wait finishes in the background and is used at the next
  start, or by the restart above.
- Where it is set: `android/app/src/main/AndroidManifest.xml` (the address, the certificate, how long a start
  waits). The app's own code shows the label (`src/Utils/selfUpdate.js`) and takes an update while open:
  `src/Services/useUpdateWhenReady.js`, with what holds a restart in `src/Utils/updateWhenReady.js` (a new
  screen where something can be half done goes in its list) and the restart itself in `AppRestart.kt`, which
  stops the app and starts it again from cold. It never reloads in place (`Updates.reloadAsync`):
  `selfUpdate.js` says why. The backend's README ("App updates") describes its side.
- iOS is not set up for it yet: `ios/PinoyRide/Supporting/Expo.plist` keeps it off.

### VERSION SHOWN TO PEOPLE

People see the version counted as the owner counts it (2026-11-25): 2.0.99, then 2.1.01, 2.1.02 … 2.1.99, then
2.2.01, a patch of two digits from 01 to 99. "2.1.01" is not a valid version number, so the real version keeps
counting as before (2.0.100, 2.0.101, …) in `package.json`, `app.json`, iOS, the self-updates (runtime
version), everything sent to the API and the bump scripts, and only what people see is mapped, by
`src/Utils/displayVersion.js` (the same file in both apps): the screens, and Android's versionName, which Google
Play and App info show (the owner, 2026-11-25: it must be the version the app shows):

| Real    | Shown  |
| ------- | ------ |
| 2.0.5   | 2.0.05 |
| 2.0.99  | 2.0.99 |
| 2.0.100 | 2.1.01 |
| 2.0.103 | 2.1.04 |
| 2.0.198 | 2.1.99 |
| 2.0.199 | 2.2.01 |

It is used on the first screen (`v2.1.04 · Develop · 3fa9c1e`), the Account page (`PinoyRide 2.1.04 · build
111`), Settings (`Pinoy Ride v2.1.04 · Develop · …`) and for the minimum on "Update Required", which the API
sends as the real version. A new place that shows the version goes through it too;
`src/Utils/__tests__/displayVersion.test.mjs` fails on a screen that shows the raw one.

Android's versionName is written shown (2.0.111 as `versionName "2.1.12"`, by `bump-version.js` through
`scripts/version-places.js`); the versionCode is the build number, +1 every release. An APK shows its own
versionName in App info, so after a self-update the app can show a newer version than App info until the next
APK. The app reads the versionName only through `src/Utils/installedVersion.js`, which turns it back into the
real version (`realVersion`, 2.1.12 → 2.0.111) for the build check, `X-App-Version` and the login: the API, its
"Update Required" minimum and the download folder compare real versions, and an APK built before 2026-11-25
(versionName 2.0.106) is sent as it is. The APK file names, the commits and `api/app-updates/<app>` keep the
real version. The way back is exact only for real versions major.0.N, so `bump-version.js` refuses any other: a
`minor` bump (2.1.0, shown 2.1.00) is not possible; leave the middle number to the display.
`bump-version.js --new-apk` (`bump-both.sh --new-apk`) makes a version a new APK although nothing native
changed, such as the first APK whose versionName is the shown version.

### APP ICON

Gold, with the riders of the logo in black. The Driver app is the other way round (black, riders in gold), so
the two are told apart at a glance.

Every icon file (`android/app/src/main/res/mipmap-*`, and `assets/ios-icon-1024.png`, which the iOS project takes
its icon from) is made by `PRTC-WBM/design/app-icons/new-logo-icons.js`; none of them is edited by hand. The 512 px picture for a
store listing is written to `PRTC-WBM/design/app-icons/store/`. The icon is part of the native app: changing it
needs a new version and a new APK.

### IOS

The iOS project (`ios/`) is made by Expo from `app.json` and the plugins it lists, and is not edited by hand:
the bundle ID (`com.pinoyride.customer`), the version and build number, the permissions and the words the app asks for
them with, the icon (`assets/ios-icon-1024.png`), the Maps key, the iOS version (15.5, which the face check's
ML Kit needs) and React Native's legacy architecture, as the Android app has (`ios.newArchEnabled`). To change
any of it, change `app.json` or a plugin, then make the folder again:

```
CI=1 npx expo prebuild --platform ios --clean --no-install
cd ios && pod install
```

Commit what it leaves in `ios/` (`ios/Pods/` stays out). The plugins in `plugins/` do what Expo's own do not,
and are the same file in both apps: `withFirebaseConfigure.js` starts Firebase, and
`withPodsForXcode27.js` makes the libraries build with Xcode 27 (each at least the app's iOS version, and
fmt as C++17).

Not ready yet: an Apple developer account (signing, TestFlight), Firebase's iOS app for the new bundle ID
(`GoogleService-Info.plist` still names `xyz.pinoyride.customer`, so push notifications do not reach an iPhone), and
self-updates. ML Kit has no simulator build for Apple-silicon Macs: try the app on an iPhone.
