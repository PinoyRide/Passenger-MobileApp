import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import native from '../../../scripts/native-signature.js';

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
  // which self-updates the installed app accepts: the ones made for its version
  assert.deepEqual(
    all(
      read('android/app/src/main/res/values/strings.xml'),
      /<string name="expo_runtime_version">([^<]+)<\/string>/g,
    ),
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

// A self-update carries JavaScript and images only. When android/ or the
// packages the app is built with change, the installed apps cannot take the
// new JavaScript, so the version has to go up (bump-version.js records the
// signature) and a new APK has to be handed out.
test('the native part of the app is as it was when this version was cut', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const record = native.recorded(root);
  assert.ok(record, `${native.RECORD} is missing: run bump-version.js`);
  assert.equal(record.runtimeVersion, version);
  assert.equal(
    record.android,
    native.nativeSignature(root),
    'android/ or a package changed since this version was cut: bump the version (node bump-version.js <next version> --code+)',
  );
});

test('self-updates are on, signed, and tied to the app version', () => {
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
  // asks at every start, and waits a little for the answer but not long
  assert.equal(setting('EXPO_UPDATES_CHECK_ON_LAUNCH'), 'ALWAYS');
  const wait = Number(setting('EXPO_UPDATES_LAUNCH_WAIT_MS'));
  assert.ok(wait >= 1000 && wait <= 5000, `the start waits ${wait} ms`);
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
