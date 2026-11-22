import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import native from '../../../scripts/native-signature.js';
import places from '../../../scripts/version-places.js';

// The version is written in several places (bump-version.js sets them all).
// package.json is the reference: every other place has to say the same.

const read = path =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

const version = JSON.parse(read('package.json')).version;
const gradle = read('android/app/build.gradle');
const build = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1]);
const all = (text, pattern) => [...text.matchAll(pattern)].map(m => m[1]);

test('the version is three numbers, and the build number is a whole number', () => {
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.ok(Number.isInteger(build) && build > 0, `versionCode is ${build}`);
});

test('every place that states the version agrees with package.json', () => {
  assert.equal(JSON.parse(read('app.json')).expo.version, version);
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
  assert.deepEqual(all(gradle, /versionName\s+"([^"]+)"/g), [version]);
  assert.deepEqual(
    all(read('android/gradle.properties'), /^MYAPP_VERSION_NAME=(.+)$/gm),
    [version],
  );
  assert.deepEqual(
    all(read('src/Services/Api.js'), /app_version:\s*'([^']+)'/g),
    [version],
  );
});

test('iOS has the same version and the same build number as Android', () => {
  const pbxproj = read('ios/pinoyride.xcodeproj/project.pbxproj');
  assert.deepEqual(all(pbxproj, /MARKETING_VERSION = ([^;]+);/g), [
    version,
    version,
  ]);
  assert.deepEqual(all(pbxproj, /CURRENT_PROJECT_VERSION = ([^;]+);/g), [
    String(build),
    String(build),
  ]);
});

// The version goes up with every change. A self-update carries JavaScript and
// images only, so which installed apps take it is decided by a second number:
// the APK version, the version at which android/ or the packages the app is
// built with last changed (native-signature.json, and the Android project).
const numbers = value => value.split('.').map(Number);
const notHigher = (a, b) => {
  const [x, y] = [numbers(a), numbers(b)];
  return (x[0] - y[0] || x[1] - y[1] || x[2] - y[2]) <= 0;
};

test('the native part of the app is the one the recorded APK version has', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const record = native.recorded(root);
  assert.ok(record, `${native.RECORD} is missing: run bump-version.js`);
  assert.equal(
    record.android,
    native.nativeSignature(root),
    'android/ or a package changed and no version was cut for it: node bump-version.js patch --code+ (it will say that a new APK is needed)',
  );
});

test('an APK built here accepts the updates made for the recorded APK version', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const record = native.recorded(root);
  assert.match(record.runtimeVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(
    places.runtimeVersionPlace.read(read(places.runtimeVersionPlace.file)),
    record.runtimeVersion,
  );
  // the APK the code needs cannot be newer than the code
  assert.ok(
    notHigher(record.runtimeVersion, version),
    `APK version ${record.runtimeVersion} is higher than the app version ${version}`,
  );
});

test('self-updates are on, signed, and tied to the APK version', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const setting = name =>
    (manifest.match(
      new RegExp(
        `android:name="expo\\.modules\\.updates\\.${name}"\\s+android:value="([^"]*)"`,
      ),
    ) || [])[1];
  assert.equal(setting('ENABLED'), 'true');
  assert.match(
    setting('EXPO_UPDATE_URL'),
    /^https:\/\/[a-z0-9.-]+\/api\/app-updates\/passenger\/manifest$/,
  );
  assert.equal(setting('EXPO_RUNTIME_VERSION'), '@string/expo_runtime_version');
  // asks at every start
  assert.equal(setting('EXPO_UPDATES_CHECK_ON_LAUNCH'), 'ALWAYS');
  // ... and waits long enough to download an update, so the app opens on it in one loading (the owner,
  // 2026-11-22), but not without end
  const wait = Number(setting('EXPO_UPDATES_LAUNCH_WAIT_MS'));
  assert.ok(wait >= 10000 && wait <= 30000, `the start waits ${wait} ms`);
  // every line of the certificate has to survive as a line (&#xA;), or Android cannot read it
  assert.match(
    setting('CODE_SIGNING_CERTIFICATE'),
    /^-----BEGIN CERTIFICATE-----&#xA;([A-Za-z0-9+/=]+&#xA;)+-----END CERTIFICATE-----&#xA;$/,
  );
  assert.deepEqual(
    JSON.parse(setting('CODE_SIGNING_METADATA').replaceAll('&quot;', '"')),
    { keyid: 'main', alg: 'rsa-v1_5-sha256' },
  );
});
