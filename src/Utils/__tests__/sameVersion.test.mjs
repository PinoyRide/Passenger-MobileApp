// One version for both apps (the owner, 2026-11-23: "make the version for
// both apps the same"): this app's version and build number are the other
// app's. mobileapps/bump-both.sh gives both the next ones. The same file in
// both apps (sharedUi.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const other = join(
  root,
  '..',
  basename(root) === 'Rider-MobileApp'
    ? 'Passenger-MobileApp'
    : 'Rider-MobileApp',
);
const skip = existsSync(join(other, 'package.json'))
  ? false
  : 'the other app is not next to this one';

const versionOf = dir =>
  JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
const buildOf = dir =>
  Number(
    (readFileSync(join(dir, 'android/app/build.gradle'), 'utf8').match(
      /versionCode\s+(\d+)/,
    ) || [])[1],
  );

test('both apps have the same version and build number', { skip }, () => {
  const fix = 'run mobileapps/bump-both.sh';
  assert.equal(
    versionOf(root),
    versionOf(other),
    `${basename(root)} and ${basename(other)} have different versions: ${fix}`,
  );
  assert.equal(
    buildOf(root),
    buildOf(other),
    `${basename(root)} and ${basename(other)} have different build numbers: ${fix}`,
  );
});
