import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The apps' Google keys are ours (A-121, 2026-11-25; project pinoy-ride-57352):
// - the Map key, where the Maps SDK reads it: AndroidManifest.xml
//   (com.google.android.geo.API_KEY), app.json (ios.config.googleMapsApiKey),
//   ios Info.plist (GMSApiKey) and AppDelegate (GMSServices.provideAPIKey);
// - the Routes key, Constants.GOOGLE_ROUTES_API_KEY, for the Directions and
//   Geocoding calls the phone makes itself. Place search goes through our API.
// The old key from outside the project (it ended MHKIQk) is in no file.
// The same file in both apps.

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.expo',
  'build',
  'Pods',
  'dist',
  '.gradle',
]);

const files = (dir = app) =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIRS.has(entry.name) ? [] : files(path);
    }
    return entry.isFile() && statSync(path).size < 2_000_000 ? [path] : [];
  });

const read = rel => readFileSync(join(app, rel), 'utf8');

// a Google API key's shape; never printed by these tests
const KEY = 'AIza[0-9A-Za-z_-]{35}';
const OLD_KEY = new RegExp(`AIza[0-9A-Za-z_-]{29}${'MHKI'}Qk`);

const one = (text, pattern, where) => {
  const found = [...text.matchAll(new RegExp(pattern, 'g'))].map(m => m[1]);
  assert.equal(found.length, 1, `one key expected in ${where}`);
  return found[0];
};

const iosDir = () =>
  readdirSync(join(app, 'ios'), { withFileTypes: true }).find(
    entry =>
      entry.isDirectory() &&
      readdirSync(join(app, 'ios', entry.name)).includes('Info.plist'),
  ).name;

const mapKeys = () => {
  const ios = iosDir();
  return {
    'AndroidManifest.xml': one(
      read('android/app/src/main/AndroidManifest.xml'),
      `android:name="com\\.google\\.android\\.geo\\.API_KEY"\\s*android:value="(${KEY})"`,
      'AndroidManifest.xml',
    ),
    'app.json': JSON.parse(read('app.json')).expo.ios.config.googleMapsApiKey,
    'Info.plist': one(
      read(`ios/${ios}/Info.plist`),
      `<key>GMSApiKey</key>\\s*<string>(${KEY})</string>`,
      'Info.plist',
    ),
    AppDelegate: one(
      read(`ios/${ios}/AppDelegate.swift`),
      `provideAPIKey\\("(${KEY})"\\)`,
      'AppDelegate.swift',
    ),
  };
};

const routesKey = () =>
  one(
    read('src/Utils/Constants.js'),
    `GOOGLE_ROUTES_API_KEY: '(${KEY})'`,
    'Constants.js',
  );

test('no file holds the old Google key (ending MHKIQk)', () => {
  const holders = files()
    .filter(path => OLD_KEY.test(readFileSync(path, 'latin1')))
    .map(path => relative(app, path));
  assert.deepEqual(holders, []);
});

test('the Maps SDK reads one Map key everywhere, not the Routes key', () => {
  const keys = mapKeys();
  const distinct = new Set(Object.values(keys));
  assert.equal(distinct.size, 1, 'the Map key differs between files');
  const [map] = distinct;
  assert.match(map, new RegExp(`^${KEY}$`), 'the Map key is not key-shaped');
  assert.ok(map !== routesKey(), 'the Map and Routes keys must be two keys');
});

test('the Routes key is its own constant; GOOGLE_MAP_API_KEY is gone', () => {
  assert.match(routesKey(), new RegExp(`^${KEY}$`));
  const old = files(join(app, 'src'))
    .filter(path => /\.(js|jsx|ts|tsx)$/.test(path))
    .filter(path => readFileSync(path, 'utf8').includes('GOOGLE_MAP_API_KEY'))
    .map(path => relative(app, path));
  assert.deepEqual(old, []);
});

test('every Google call from the phone is Directions or Geocoding, with the Routes key', () => {
  const callers = files(join(app, 'src'))
    .filter(path => /\.(js|jsx|ts|tsx)$/.test(path))
    .filter(path => !path.includes('__tests__'))
    .map(path => [relative(app, path), readFileSync(path, 'utf8')])
    .filter(([, text]) => text.includes('maps.googleapis.com'));

  assert.ok(callers.length > 0, 'expected the Directions/Geocoding callers');

  for (const [rel, text] of callers) {
    const apis = [...text.matchAll(/maps\.googleapis\.com\/maps\/api\/(\w+)/g)];
    for (const [, api] of apis) {
      assert.ok(
        api === 'directions' || api === 'geocode',
        `${rel}: ${api} is not allowed on the Routes key (place search goes through our API)`,
      );
    }
    // each `key=${x}`: the Routes constant, or a name given it in that file
    const keyed = [...text.matchAll(/key=\$\{([\w.]+)\}/g)].map(m => m[1]);
    assert.equal(
      keyed.length,
      apis.length,
      `${rel}: every Google URL carries a key`,
    );
    for (const name of keyed) {
      const routes =
        name === 'Constants.GOOGLE_ROUTES_API_KEY' ||
        new RegExp(
          `\\b${name.replace(
            '.',
            '\\.',
          )}\\s*=\\s*Constants\\.GOOGLE_ROUTES_API_KEY\\b`,
        ).test(text);
      assert.ok(routes, `${rel}: key=\${${name}} is not the Routes key`);
    }
  }
});
