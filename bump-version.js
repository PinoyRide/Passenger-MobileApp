#!/usr/bin/env node
/**
 * bump-version.js
 *
 * Bumps the app version across every file that hardcodes it.
 *
 * Usage:
 *   node bump-version.js 1.0.18
 *   node bump-version.js 1.0.18 --code=23   (also set an explicit versionCode)
 *   node bump-version.js 1.0.18 --code+     (auto-increment versionCode by 1)
 *
 * Edit the FILES array below if any path doesn't match your project layout.
 */

const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
const codeArg = process.argv.find(a => a.startsWith('--code'));

if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(
    'Usage: node bump-version.js <version> e.g. node bump-version.js 1.0.18',
  );
  process.exit(1);
}

const ROOT = process.cwd();

// ---- Configure these paths for your project ----
const FILES = [
  {
    file: 'package.json',
    replace: content =>
      content.replace(/("version"\s*:\s*")[\d.]+(")/, `$1${newVersion}$2`),
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
      if (codeArg) {
        out = out.replace(/(versionCode\s+)(\d+)/, (m, prefix, num) => {
          if (codeArg === '--code+') {return `${prefix}${parseInt(num, 10) + 1}`;}
          const explicit = codeArg.split('=')[1];
          return explicit ? `${prefix}${explicit}` : m;
        });
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
  }.`,
);
if (missing) {
  console.log(
    'Edit the FILES array at the top of this script to fix any wrong paths.',
  );
}
