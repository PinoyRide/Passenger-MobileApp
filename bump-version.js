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
 * Edit the FILES array below if any path doesn't match your project layout.
 */

const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
const codeArg = process.argv.find(a => a.startsWith('--code'));

if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(
    'Usage: node bump-version.js <version> [--code+ | --code=N]   e.g. node bump-version.js 2.0.1 --code+',
  );
  process.exit(1);
}

const ROOT = process.cwd();

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

// ---- Configure these paths for your project ----
const FILES = [
  {
    file: 'package.json',
    replace: content =>
      content.replace(/("version"\s*:\s*")[\d.]+(")/, `$1${newVersion}$2`),
  },
  // Only the two entries at the top that describe this app itself; every
  // other "version" in the lock file belongs to a dependency.
  {
    file: 'package-lock.json',
    replace: content =>
      content
        .replace(
          /^(\{\s*"name": "[^"]+",\s*"version": ")[\d.]+(")/,
          `$1${newVersion}$2`,
        )
        .replace(
          /("packages": \{\s*"": \{\s*"name": "[^"]+",\s*"version": ")[\d.]+(")/,
          `$1${newVersion}$2`,
        ),
    optional: true,
  },
  {
    file: 'app.json',
    replace: content =>
      content.replace(/("version"\s*:\s*")[\d.]+(")/, `$1${newVersion}$2`),
  },
  {
    file: 'android/gradle.properties',
    replace: content =>
      content.replace(/(MYAPP_VERSION_NAME=)[\d.]+/, `$1${newVersion}`),
  },
  {
    file: 'android/app/build.gradle',
    replace: content => {
      let out = content.replace(
        /(versionName\s+")[\d.]+(")/,
        `$1${newVersion}$2`,
      );
      if (newCode !== null) {
        out = out.replace(/(versionCode\s+)\d+/, `$1${newCode}`);
      }
      return out;
    },
  },
  // iOS keeps the version and the build number once per build configuration.
  {
    file: 'ios/pinoyride.xcodeproj/project.pbxproj',
    replace: content => {
      let out = content.replace(
        /(MARKETING_VERSION = )[\d.]+;/g,
        `$1${newVersion};`,
      );
      if (newCode !== null) {
        out = out.replace(/(CURRENT_PROJECT_VERSION = )\d+;/g, `$1${newCode};`);
      }
      return out;
    },
  },
  // The API hook hardcodes app_version as a literal string. Point this at
  // wherever that file actually lives in your repo.
  {
    file: 'src/Services/Api.js',
    replace: content =>
      content.replace(/(app_version:\s*')[\d.]+(')/, `$1${newVersion}$2`),
    optional: true,
  },
];

let changed = 0;
let missing = 0;

for (const { file, replace, optional } of FILES) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) {
    if (!optional) {
      console.warn(`⚠️  Not found (adjust path in script): ${file}`);
      missing++;
    } else {
      console.warn(`⚠️  Not found, skipping (optional): ${file}`);
    }
    continue;
  }

  const original = fs.readFileSync(fullPath, 'utf8');
  const updated = replace(original);

  if (updated === original) {
    console.warn(
      `⚠️  No match found in ${file} — check the pattern still fits`,
    );
    continue;
  }

  fs.writeFileSync(fullPath, updated, 'utf8');
  console.log(`✅ Updated ${file}`);
  changed++;
}

console.log(
  `\nDone. ${changed} file(s) updated${
    missing ? `, ${missing} file(s) not found` : ''
  }. Version ${newVersion}${newCode !== null ? `, build ${newCode}` : ''}.`,
);
if (missing) {
  console.log(
    'Edit the FILES array at the top of this script to fix any wrong paths.',
  );
}
