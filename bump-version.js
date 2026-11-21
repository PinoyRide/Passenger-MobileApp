#!/usr/bin/env node
/**
 * bump-version.js
 *
 * Gives the app its next version and build number, in every file that
 * states them, Android and iOS.
 *
 * Every change to the app gets a new version and a new build number, as a
 * commit of its own that lands together with the change. The build number
 * is Android's versionCode and iOS's CURRENT_PROJECT_VERSION: always the
 * same on both.
 *
 * Usage:
 *   node bump-version.js patch --code+     2.0.1 -> 2.0.2, build number + 1: the usual
 *   node bump-version.js minor --code+     2.0.1 -> 2.1.0
 *   node bump-version.js major --code+     2.0.1 -> 3.0.0
 *   node bump-version.js 2.4.0 --code+     a version of your choosing
 *   node bump-version.js 2.4.0 --code=23   ... with an explicit build number
 *   node bump-version.js 2.4.0             the version only; the build number stays
 *
 * It also works out how the change reaches the phones, and says so:
 *
 * - Nothing native changed (android/, the packages the app is built with):
 *   installed apps take the new version as a self-update.
 *   native-signature.json keeps naming the APK version they need.
 * - The native part changed: the new version needs a new APK.
 *   native-signature.json and the Android project are set to it, and apps
 *   installed before keep the last update that was made for them.
 *
 * Afterwards `node --test src/Utils/__tests__/` checks that every place
 * agrees. The places are listed in scripts/version-places.js: edit that
 * list if a path doesn't match the project layout.
 */

const fs = require('fs');
const path = require('path');
const { places, runtimeVersionPlace } = require('./scripts/version-places');
const {
  nativeSignature,
  recorded,
  RECORD,
} = require('./scripts/native-signature');

const ROOT = process.cwd();

const wanted = process.argv[2];
const codeArg = process.argv.find(a => a.startsWith('--code'));

const isVersion = value => /^\d+\.\d+\.\d+$/.test(value || '');
const numbers = version => version.split('.').map(Number);
// Negative when a is the lower version, 0 when they are the same.
const compare = (a, b) => {
  const [x, y] = [numbers(a), numbers(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
const NEXT = {
  patch: ([major, minor, patch]) => `${major}.${minor}.${patch + 1}`,
  minor: ([major, minor]) => `${major}.${minor + 1}.0`,
  major: ([major]) => `${major + 1}.0.0`,
};

const currentVersion = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
).version;
const newVersion =
  NEXT[wanted] && isVersion(currentVersion)
    ? NEXT[wanted](numbers(currentVersion))
    : wanted;

if (!isVersion(newVersion)) {
  console.error(
    'Usage: node bump-version.js <patch | minor | major | version> [--code+ | --code=N]\n' +
      '  e.g. node bump-version.js patch --code+',
  );
  process.exit(1);
}
if (isVersion(currentVersion) && compare(newVersion, currentVersion) < 0) {
  console.error(
    `\n${newVersion} is lower than the current version, ${currentVersion}. Versions only go up.\n`,
  );
  process.exit(1);
}

// The build number after this bump: read from Android, where it lives.
const GRADLE = 'android/app/build.gradle';
const currentCode = (() => {
  const gradlePath = path.join(ROOT, GRADLE);
  if (!fs.existsSync(gradlePath)) {
    return null;
  }
  const found = fs
    .readFileSync(gradlePath, 'utf8')
    .match(/versionCode\s+(\d+)/);
  return found ? parseInt(found[1], 10) : null;
})();
const newCode = (() => {
  if (!codeArg || currentCode === null) {
    return currentCode;
  }
  if (codeArg === '--code+') {
    return currentCode + 1;
  }
  const explicit = parseInt(codeArg.split('=')[1], 10);
  return Number.isInteger(explicit) && explicit > 0 ? explicit : currentCode;
})();

// ---- Does this change travel as a self-update, or does it need a new APK? ----
// A self-update replaces only the JavaScript and the images. An installed
// app takes every update made for its APK version (the update library's
// "runtime version"), so that number stays as it is for as long as the
// native part of the app does, and moves to the new version when the
// native part changed. See scripts/native-signature.js.
const signature = nativeSignature(ROOT);
const record = recorded(ROOT);
const nativeChanged = !record || record.android !== signature;
if (
  nativeChanged &&
  record &&
  compare(newVersion, record.runtimeVersion) <= 0
) {
  console.error(
    `\nThe native part of the app (android/ or the packages it is built with) changed since the ${record.runtimeVersion} APK.\n` +
      `A change like that needs a new APK, and a new APK needs a version number of its own, higher than ${record.runtimeVersion}.\n` +
      'Run this again with the next one:\n\n' +
      '  node bump-version.js patch --code+\n',
  );
  process.exit(1);
}
const runtimeVersion = nativeChanged ? newVersion : record.runtimeVersion;

// Every place the version is written lives in scripts/version-places.js.
const withRuntimeVersion = version => ({
  file: runtimeVersionPlace.file,
  replace: content => runtimeVersionPlace.replace(content, version),
});
const FILES = [
  ...places(newVersion, newCode),
  withRuntimeVersion(runtimeVersion),
];
// The same list with numbers no app has, to tell "this file already says so" from "the pattern no longer fits".
const PROBES = [
  ...places('999.999.999', 999999),
  withRuntimeVersion('999.999.999'),
];

let changed = 0;
let missing = 0;
let unmatched = 0;

FILES.forEach(({ file, replace, optional }, index) => {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) {
    if (!optional) {
      console.warn(`⚠️  Not found (adjust path in script): ${file}`);
      missing++;
    } else {
      console.warn(`⚠️  Not found, skipping (optional): ${file}`);
    }
    return;
  }

  const original = fs.readFileSync(fullPath, 'utf8');
  const updated = replace(original);

  if (updated === original) {
    if (PROBES[index].replace(original) === original) {
      console.warn(
        `⚠️  No match found in ${file} — check the pattern still fits`,
      );
      unmatched++;
    } else {
      console.log(`·  Already says so: ${file}`);
    }
    return;
  }

  fs.writeFileSync(fullPath, updated, 'utf8');
  console.log(`✅ Updated ${file}`);
  changed++;
});

// The APK version and the native part it stands for (scripts/pack-update.mjs packs self-updates for it).
fs.writeFileSync(
  path.join(ROOT, RECORD),
  JSON.stringify({ runtimeVersion, android: signature }, null, 2) + '\n',
  'utf8',
);

console.log(
  `\nDone. ${changed} file(s) updated${
    missing ? `, ${missing} file(s) not found` : ''
  }. Version ${newVersion}${newCode !== null ? `, build ${newCode}` : ''}.`,
);
if (nativeChanged) {
  console.log(
    `\n📦 The native part of the app changed: ${newVersion} needs a NEW APK.\n` +
      '   Build it from this commit once it is in Develop, and hand it out. Apps installed before it\n' +
      '   keep the last update that was made for them.',
  );
} else {
  console.log(
    `\n📲 Nothing native changed: installed apps take ${newVersion} as a self-update.\n` +
      `   It runs on the ${runtimeVersion} APK and every APK built since.`,
  );
}
if (missing || unmatched) {
  console.log(
    'Edit scripts/version-places.js to fix any wrong path or pattern.',
  );
  process.exit(1);
}
