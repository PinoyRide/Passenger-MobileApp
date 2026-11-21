// The "native signature": one checksum over everything an installed Android app cannot get from a
// self-update, which is the Android project and the versions of the packages the app is built with.
//
// A self-update only replaces the JavaScript and the images. If any of this changed, the new JavaScript may
// need native code that the installed app does not have, so it must not be sent to it: the app needs a new
// version number (bump-version.js records the new signature in native-signature.json) and a new APK.
//
// The version and build number written inside the Android project are looked past: a new build of the same
// version, with nothing else changed, has the same signature.
//
// Used by bump-version.js (records it, and refuses to keep a version number whose signature changed),
// scripts/pack-update.mjs (refuses to pack when it no longer matches) and the version test.
const { Buffer } = require('buffer');
const { execFileSync } = require('child_process');
const { createHash } = require('crypto');
const { existsSync, readFileSync, readdirSync, statSync } = require('fs');
const { join } = require('path');
const { places } = require('./version-places');

const NATIVE_FOLDER = 'android';

// What a build leaves behind inside the folder. Not all of it is ignored by git (android/.kotlin is not), and
// none of it is part of the app.
const LEFT_BY_BUILDS = new Set([
  'build',
  '.gradle',
  '.cxx',
  '.kotlin',
  '.idea',
  'local.properties',
  '.DS_Store',
]);

// Git's own ignore lists do not count either: no build reads them.
const counts = path =>
  !path.endsWith('.iml') &&
  !path.endsWith('/.gitignore') &&
  !path.split('/').some(part => LEFT_BY_BUILDS.has(part));

function walk(root, dir, found) {
  for (const name of readdirSync(join(root, dir)).sort()) {
    const path = `${dir}/${name}`;
    if (!counts(path)) {
      continue;
    }
    if (statSync(join(root, path)).isDirectory()) {
      walk(root, path, found);
    } else {
      found.push(path);
    }
  }
  return found;
}

// With git, the files it tracks or would track are the right set. Without git (a build service that hands
// over only the files), the folder is walked.
function nativeFiles(root) {
  try {
    // Tracked files, and new ones that are not ignored (they will be tracked once added).
    const out = execFileSync(
      'git',
      [
        'ls-files',
        '-z',
        '--cached',
        '--others',
        '--exclude-standard',
        '--',
        NATIVE_FOLDER,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    const files = [...new Set(out.split('\0').filter(Boolean))].filter(counts);
    if (files.length > 0) {
      return files.sort();
    }
  } catch {
    // not a git checkout: fall through
  }
  return existsSync(join(root, NATIVE_FOLDER))
    ? walk(root, NATIVE_FOLDER, []).sort()
    : [];
}

// Every package the app itself is built with (not the tools used only while developing), at the exact version
// the lock file pins. All of them, not only the ones with native code: the lock file does not say which have
// any, and guessing wrong would send JavaScript to an app that cannot run it.
function builtWith(root) {
  const lock = JSON.parse(
    readFileSync(join(root, 'package-lock.json'), 'utf8'),
  );
  return Object.entries(lock.packages)
    .filter(([path, entry]) => path !== '' && !entry.dev && !entry.link)
    .map(([path, entry]) => `${path}@${entry.version}`)
    .sort();
}

function nativeSignature(root) {
  // Where a version or build number is written, read the file as if it said 0.0.0 and build 0.
  const lookPast = new Map(
    places('0.0.0', 0).map(({ file, replace }) => [file, replace]),
  );
  const sum = createHash('sha256');
  for (const path of nativeFiles(root)) {
    if (!existsSync(join(root, path))) {
      continue; // deleted in the working tree
    }
    let data = readFileSync(join(root, path));
    if (lookPast.has(path)) {
      data = Buffer.from(lookPast.get(path)(data.toString('utf8')));
    }
    const digest = createHash('sha256').update(data).digest('hex');
    sum.update(`${path}\0${digest}\n`);
  }
  for (const line of builtWith(root)) {
    sum.update(`${line}\n`);
  }
  return sum.digest('hex');
}

const RECORD = 'native-signature.json';

// { runtimeVersion, android } as written by bump-version.js, or null before the first bump that records it.
function recorded(root) {
  const path = join(root, RECORD);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

module.exports = { nativeSignature, recorded, RECORD };
