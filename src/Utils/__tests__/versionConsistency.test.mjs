import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

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
