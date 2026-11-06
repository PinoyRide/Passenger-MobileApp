import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const read = path =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

test('1.1.5 is consistent across app, API and Android versionName', () => {
  assert.match(read('package.json'), /"version": "1\.1\.5"/);
  assert.match(read('app.json'), /"version": "1\.1\.5"/);
  assert.match(read('src/Services/Api.js'), /app_version: '1\.1\.5'/);
  assert.match(read('android/gradle.properties'), /MYAPP_VERSION_NAME=1\.1\.5/);
  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /versionCode 6/);
  assert.match(gradle, /versionName "1\.1\.5"/);
});

test('iOS 1.1.5 uses build 6 for every iOS target', () => {
  const pbxproj = read('ios/pinoyride.xcodeproj/project.pbxproj');
  assert.equal(
    (pbxproj.match(/MARKETING_VERSION = 1\.1\.5;/g) || []).length,
    2,
  );
  assert.equal(
    (pbxproj.match(/CURRENT_PROJECT_VERSION = 6;/g) || []).length,
    2,
  );
});
