// Every place that states the app's version or build number, and how to set it there.
//
// bump-version.js writes them. scripts/native-signature.js uses the same list to look past them, so that a
// new version number alone does not count as a change to the native part of the app.
//
// Two numbers are kept apart:
// - The version and build number (places): they go up with every change to the app.
// - The APK version (runtimeVersionPlace): the version at which the native part of the app last changed,
//   which is the oldest APK that can run this code. The update library calls it the runtime version. An
//   installed app takes any self-update made for its APK version, so this number only moves when a change
//   needs a new APK.
//
// Edit this list if a path does not match the project layout.

function places(version, code) {
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
    {
      file: 'app.json',
      replace: content =>
        content.replace(/("version"\s*:\s*")[\d.]+(")/, `$1${version}$2`),
    },
    {
      file: 'android/gradle.properties',
      replace: content =>
        content.replace(/(MYAPP_VERSION_NAME=)[\d.]+/, `$1${version}`),
    },
    {
      file: 'android/app/build.gradle',
      replace: content => {
        let out = content.replace(
          /(versionName\s+")[\d.]+(")/,
          `$1${version}$2`,
        );
        if (setCode) {
          out = out.replace(/(versionCode\s+)\d+/, `$1${code}`);
        }
        return out;
      },
    },
    // iOS keeps the version and the build number once per build configuration.
    {
      file: 'ios/pinoyride.xcodeproj/project.pbxproj',
      replace: content => {
        let out = content.replace(
          /(MARKETING_VERSION = )[\d.]+;/g,
          `$1${version};`,
        );
        if (setCode) {
          out = out.replace(/(CURRENT_PROJECT_VERSION = )\d+;/g, `$1${code};`);
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
