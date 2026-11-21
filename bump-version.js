#!/usr/bin/env node
/**
 * bump-version.js
 *
 * Bumps the app version across every file that hardcodes it, Android and iOS.
 *
 * A release has a version (2.0.0) and a build number that goes up by one
 * with every released build. The build number is Android's versionCode and
 * iOS's CURRENT_PROJECT_VERSION: always the same on both.
 *
 * Usage:
 *   node bump-version.js 2.0.1 --code+     (new version, build number + 1: the usual)
 *   node bump-version.js 2.0.1 --code=23   (new version, explicit build number)
 *   node bump-version.js 2.0.1             (new version only; the build number stays)
 *
 * Afterwards `node --test src/Utils/__tests__/` checks that every place agrees.
 * The places are listed in scripts/version-places.js: edit that list if a path
 * doesn't match the project layout.
 *
 * It also records the version's "native signature" in native-signature.json,
 * and refuses to keep a version number when the native part of the app changed:
 * see scripts/native-signature.js.
 */

const fs = require('fs');
const path = require('path');
const { places } = require('./scripts/version-places');
const {
  nativeSignature,
  recorded,
  RECORD,
} = require('./scripts/native-signature');

const newVersion = process.argv[2];
const codeArg = process.argv.find(a => a.startsWith('--code'));

if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(
    'Usage: node bump-version.js <version> [--code+ | --code=N]   e.g. node bump-version.js 2.0.1 --code+',
  );
  process.exit(1);
}

const ROOT = process.cwd();

const nextPatch = version => {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
};

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

// Every place the version is written lives in scripts/version-places.js.
const FILES = places(newVersion, newCode);
// The same list with numbers no app has, to tell "this file already says so" from "the pattern no longer fits".
const PROBES = places('999.999.999', 999999);

// ---- Can an installed app of this version still take self-updates? ----
// A self-update replaces only the JavaScript and the images. When the native part of the app changed, the
// version number has to change with it, so that apps already installed are not sent JavaScript they cannot
// run. See scripts/native-signature.js.
const signature = nativeSignature(ROOT);
const record = recorded(ROOT);
if (
  record &&
  record.runtimeVersion === newVersion &&
  record.android !== signature
) {
  console.error(
    `\nThe native part of the app (android/ or the packages it is built with) changed since ${newVersion} was cut.\n` +
      `Apps already installed as ${newVersion} cannot run JavaScript written for it, so this build needs a new\n` +
      'version number. Run this again with the next one, for example:\n\n' +
      `  node bump-version.js ${nextPatch(newVersion)} --code+\n`,
  );
  process.exit(1);
}

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

// The version's native signature, for the self-updates (scripts/pack-update.mjs checks against it).
fs.writeFileSync(
  path.join(ROOT, RECORD),
  JSON.stringify({ runtimeVersion: newVersion, android: signature }, null, 2) +
    '\n',
  'utf8',
);
console.log(`✅ Recorded the native signature in ${RECORD}`);

console.log(
  `\nDone. ${changed} file(s) updated${
    missing ? `, ${missing} file(s) not found` : ''
  }. Version ${newVersion}${newCode !== null ? `, build ${newCode}` : ''}.`,
);
if (missing || unmatched) {
  console.log(
    'Edit scripts/version-places.js to fix any wrong path or pattern.',
  );
  process.exit(1);
}
