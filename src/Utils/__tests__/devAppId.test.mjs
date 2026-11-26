import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Develop builds are <id>.dev, named "... DEV"; only a Google Play build (-PpinoyridePlay=true) keeps the real
// id (DEV-APP-ID, owner A-285/A-294). The same file in both apps.

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(resolve(app, path), 'utf8');
const gradle = read('android/app/build.gradle');
const manifest = read('android/app/src/main/AndroidManifest.xml');
const id = gradle.match(/applicationId '([^']+)'/)[1];

test('a Develop build gets the .dev suffix; only a Play build drops it', () => {
  assert.match(gradle, /def playBuild = \(findProperty\('pinoyridePlay'\) \?: 'false'\)\.toString\(\)\.toBoolean\(\)/);
  assert.match(gradle, /if \(!playBuild\) \{\s*applicationIdSuffix '\.dev'\s*\}/);
  assert.ok(['com.pinoyride.customer', 'com.pinoyride.rider'].includes(id), `the base id stays ${id}`);
});

test('the launcher name says DEV on Develop builds', () => {
  const label = gradle.match(/resValue 'string', 'app_label', playBuild \? '([^']+)' : '([^']+)'/);
  assert.ok(label, 'app_label is set by the build');
  assert.equal(label[2], `${label[1]} DEV`);
  assert.match(manifest, /android:label="@string\/app_label"/);
});

test('Firebase knows both the Play id and the .dev id', () => {
  const services = JSON.parse(read('android/app/google-services.json'));
  const ids = services.client.map(c => c.client_info.android_client_info.package_name);
  assert.ok(ids.includes(id), `${id} is registered`);
  assert.ok(ids.includes(`${id}.dev`), `${id}.dev is registered`);
});
