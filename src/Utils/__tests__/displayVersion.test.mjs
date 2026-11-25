import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mod from '../displayVersion.js';

const { displayVersion } = mod;

// The owner, 2026-11-25 (option B): people see 2.0.99 → 2.1.01 → 2.1.02, a
// patch of two digits; the real version stays valid semver (2.0.100, …).
test('the owner’s table', () => {
  const table = {
    '2.0.1': '2.0.01',
    '2.0.5': '2.0.05',
    '2.0.10': '2.0.10',
    '2.0.98': '2.0.98',
    '2.0.99': '2.0.99',
    '2.0.100': '2.1.01',
    '2.0.101': '2.1.02',
    '2.0.102': '2.1.03',
    '2.0.103': '2.1.04',
    '2.0.197': '2.1.98',
    '2.0.198': '2.1.99',
    '2.0.199': '2.2.01',
    '2.0.200': '2.2.02',
    '2.0.297': '2.2.99',
    '2.0.298': '2.3.01',
  };
  for (const [real, shown] of Object.entries(table)) {
    assert.equal(displayVersion(real), shown, real);
  }
});

test('the major number never changes, the minor carries what it had', () => {
  assert.equal(displayVersion('3.0.100'), '3.1.01');
  assert.equal(displayVersion('2.4.7'), '2.4.07');
  assert.equal(displayVersion('2.4.100'), '2.5.01');
  assert.equal(displayVersion('10.20.199'), '10.22.01');
});

test('a patch of 0 is shown as two digits too', () => {
  assert.equal(displayVersion('2.0.0'), '2.0.00');
  assert.equal(displayVersion('1.0.0'), '1.0.00');
});

test('from 1 on, every real patch shows a different version, in order, never .00 or three digits', () => {
  const seen = new Set();
  let before = null;
  for (let p = 1; p <= 5000; p += 1) {
    const shown = displayVersion(`2.0.${p}`);
    const [major, minor, patch] = shown.split('.');
    assert.equal(major, '2');
    assert.match(patch, /^(0[1-9]|[1-9]\d)$/, `2.0.${p} → ${shown}`);
    assert.ok(!seen.has(shown), `2.0.${p} → ${shown} shown twice`);
    seen.add(shown);
    const now = [Number(minor), Number(patch)];
    if (before) {
      assert.ok(
        now[0] > before[0] ||
          (now[0] === before[0] && now[1] === before[1] + 1),
        `2.0.${p} → ${shown} does not follow the one before`,
      );
    }
    before = now;
  }
});

test('anything that is not three whole numbers comes back as it was given', () => {
  for (const odd of [
    '2.0',
    '2',
    '',
    ' 2.0.103',
    '2.0.103 ',
    'v2.0.103',
    '2.0.103-beta',
    '2.0.x',
    '2..103',
    'garbage',
    '—',
  ]) {
    assert.equal(displayVersion(odd), odd, JSON.stringify(odd));
  }
  assert.equal(displayVersion(undefined), undefined);
  assert.equal(displayVersion(null), null);
  assert.equal(displayVersion(2), 2);
  assert.equal(
    displayVersion('2.0.99999999999999999999'),
    '2.0.99999999999999999999',
  );
});

// ---- where it is used ------------------------------------------------------

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');
const filesUnder = dir =>
  readdirSync(join(app, dir), { recursive: true })
    .filter(name => /\.(js|jsx|ts|tsx)$/.test(name))
    .map(name => join(dir, name));

// The three places a person reads the app's version, and the minimum on the
// "Update Required" screen, the same paths in both apps.
const SHOWN = [
  'src/Screens/Login/LandingScreen.js', // v2.1.04 · Develop · 3fa9c1e
  'src/Screens/SettingsScreen/SettingsScreen.js', // PinoyRide 2.1.04 · build 111
  'src/Screens/SettingsScreen/AccountSettingsScreen.js', // Pinoy Ride v2.1.04 · Develop · …
];

for (const file of SHOWN) {
  test(`${file} shows the version through displayVersion`, () => {
    const source = read(file);
    assert.match(
      source,
      /import \{ displayVersion \} from '@\/Utils\/displayVersion';/,
    );
    assert.match(source, /displayVersion\(\s*Constants\.expoConfig\?\.version/);
  });
}

test('the Update Required screen shows the minimum through displayVersion', () => {
  const source = read('src/Screens/Login/UpdateRequiredScreen.js');
  assert.match(
    source,
    /import \{ displayVersion \} from '@\/Utils\/displayVersion';/,
  );
  assert.match(source, /displayVersion\(minimumVersion\)/);
  assert.doesNotMatch(source, /\{minimumVersion \|\|/);
});

test('no screen shows the raw version', () => {
  const raw =
    /expoConfig\??\.version|nativeApplicationVersion|getReadableVersion/g;
  for (const file of [
    ...filesUnder('src/Screens'),
    ...filesUnder('src/Components'),
    'App.js',
  ]) {
    const source = read(file);
    for (const hit of source.matchAll(raw)) {
      const before = source.slice(Math.max(0, hit.index - 40), hit.index);
      assert.match(
        before,
        /displayVersion\(\s*(Constants\.)?$/,
        `${file} uses ${hit[0]} without displayVersion`,
      );
    }
  }
});

// The real version is what the API and the self-updates compare: nothing that
// talks to them goes through the display.
test('what is sent to the API keeps the real version', () => {
  const technical = [
    ...filesUnder('src/Services'),
    ...filesUnder('src/Utils').filter(
      file =>
        !file.includes('__tests__') && !file.endsWith('displayVersion.js'),
    ),
  ];
  for (const file of technical) {
    assert.doesNotMatch(read(file), /displayVersion/, file);
  }
  // the build check asks with the installed version, and every signed request
  // carries the real one (2.0.103, never 2.1.04)
  assert.match(
    read('src/Utils/askBuildCheck.js'),
    /DeviceInfo\.getVersion\(\)/,
  );
  const { version } = JSON.parse(read('package.json'));
  assert.ok(
    read('src/Services/Api.js').includes(`app_version: '${version}'`),
    'src/Services/Api.js sends the real version',
  );
});
