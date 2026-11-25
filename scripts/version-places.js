// Every place that states the app's version or build number, and how to set it there.
//
// bump-version.js writes them. scripts/native-signature.js uses the same list to look past them, so that a
// new version number alone does not count as a change to the native part of the app.
//
// Two numbers are kept apart:
// - The version and build number (places): they go up with every change to the app. The version is
//   written as it is (2.0.111) everywhere but Android's versionName (and MYAPP_VERSION_NAME beside it),
//   which is the version people see, 2.1.12 (src/Utils/displayVersion.js): what Google Play and Android's
//   App info show has to be what the app shows (the owner, 2026-11-25). The app sends it back as the real
//   version (src/Utils/installedVersion.js).
// - The APK version (runtimeVersionPlace): the version at which the native part of the app last changed,
//   which is the oldest APK that can run this code. The update library calls it the runtime version. An
//   installed app takes any self-update made for its APK version, so this number only moves when a change
//   needs a new APK.
//
// Edit this list if a path does not match the project layout.

const { displayVersion } = require('../src/Utils/displayVersion');

// `shown` is what Android's versionName says: the shown version, unless given (native-signature.js looks
// past it with 0.0.0, as before 2026-11-25, so that the recorded signatures still hold).
function places(version, code, shown = displayVersion(version)) {
  const setCode = code !== null && code !== undefined;
  return [
    {
      file: 'package.json',
      replace: content =>
        content.replace(/("version"\s*:\s*")[\d.]+(")/, `$1${version}$2`),
    },
    // Only the two entries at the top that describe this app itself; every
    // other "version" in the lock file belongs to a dependency.
    {
      file: 'package-lock.json',
      replace: content =>
        content
          .replace(
            /^(\{\s*"name": "[^"]+",\s*"version": ")[\d.]+(")/,
            `$1${version}$2`,
          )
          .replace(
            /("packages": \{\s*"": \{\s*"name": "[^"]+",\s*"version": ")[\d.]+(")/,
            `$1${version}$2`,
          ),
      optional: true,
    },
    // app.json is also what the iOS project is made from (npx expo prebuild
    // --platform ios): its version and ios.buildNumber.
    {
      file: 'app.json',
      replace: content => {
        let out = content.replace(
          /("version"\s*:\s*")[\d.]+(")/,
          `$1${version}$2`,
        );
        if (setCode) {
          out = out.replace(/("buildNumber"\s*:\s*")\d+(")/, `$1${code}$2`);
        }
        return out;
      },
    },
    {
      file: 'android/gradle.properties',
      replace: content =>
        content.replace(/(MYAPP_VERSION_NAME=)[\d.]+/, `$1${shown}`),
    },
    {
      file: 'android/app/build.gradle',
      replace: content => {
        let out = content.replace(/(versionName\s+")[\d.]+(")/, `$1${shown}$2`);
        if (setCode) {
          out = out.replace(/(versionCode\s+)\d+/, `$1${code}`);
        }
        return out;
      },
    },
    // The iOS app (Expo 54, made by prebuild) states them in its Info.plist,
    // from app.json; the project file's own numbers are unused placeholders.
    {
      file: 'ios/PinoyRide/Info.plist',
      replace: content => {
        let out = content.replace(
          /(<key>CFBundleShortVersionString<\/key>\s*<string>)[\d.]+(<\/string>)/,
          `$1${version}$2`,
        );
        if (setCode) {
          out = out.replace(
            /(<key>CFBundleVersion<\/key>\s*<string>)\d+(<\/string>)/,
            `$1${code}$2`,
          );
        }
        return out;
      },
    },
    // The API hook hardcodes app_version as a literal string.
    {
      file: 'src/Services/Api.js',
      replace: content =>
        content.replace(/(app_version:\s*')[\d.]+(')/, `$1${version}$2`),
      optional: true,
    },
    // The build number the app's own screens show (the Account page): a
    // self-update carries its version, not its build number.
    {
      file: 'src/Utils/appBuild.js',
      replace: content =>
        setCode ? content.replace(/(APP_BUILD = )\d+/, `$1${code}`) : content,
      optional: true,
    },
  ];
}

// Which self-updates an APK built from this project accepts: the ones made for this APK version.
const runtimeVersionPlace = {
  file: 'android/app/src/main/res/values/strings.xml',
  replace: (content, runtimeVersion) =>
    content.replace(
      /(<string name="expo_runtime_version">)[\d.]+(<\/string>)/,
      `$1${runtimeVersion}$2`,
    ),
  read: content =>
    (content.match(/<string name="expo_runtime_version">([^<]+)<\/string>/) ||
      [])[1],
};

module.exports = { places, runtimeVersionPlace };
