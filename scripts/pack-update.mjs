// Packs a self-update for the installed apps, after `expo export --platform android` has written dist/.
//
// The backend (PRTC-BackEnd, "app updates") fetches what this writes into update-publish/ and hands it to the
// phones, signed:
//   update.tgz    manifest.json (which files make up the update, with their checksums) and the files, each
//                 under files/<the SHA-256 of its bytes>
//   update.json   which build this is, the archive's checksum and size
//   index.html    a note for anyone who opens the address in a browser
//
// The update is packed for the APK version in native-signature.json: every app installed from that APK or a
// later one takes it, whatever version the code has reached since. It refuses to pack when the native part
// of the app changed and no version was cut for that: such a change cannot reach an installed app by itself,
// and JavaScript that expects it would crash there.
//
// usage: node scripts/pack-update.mjs <app name>      (passenger | rider)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import native from './native-signature.js';
import places from './version-places.js';

const { runtimeVersionPlace } = places;

const root = resolve(import.meta.dirname, '..');
const app = process.argv[2];
const dist = join(root, 'dist');
const out = join(root, 'update-publish');

const stop = message => {
  console.error(`\npack-update: ${message}\n`);
  process.exit(1);
};

if (!/^[a-z][a-z0-9-]{1,30}$/.test(app ?? '')) {
  stop(
    'give the app name, for example: node scripts/pack-update.mjs passenger',
  );
}
if (!existsSync(join(dist, 'metadata.json'))) {
  stop('there is no export in dist/. Run: npx expo export --platform android');
}

// ---- Which installed apps can take this update ---------------------------------------------------------
// The update carries the app's current version (package.json), which goes up with every change. Which
// installed apps take it is decided by the APK version in native-signature.json (the update library's
// "runtime version"): the version at which the native part of the app last changed.
const version = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8'),
).version;
const record = native.recorded(root);
if (!record) {
  stop(`${native.RECORD} is missing. Run bump-version.js, which writes it.`);
}
if (record.android !== native.nativeSignature(root)) {
  stop(
    `the native part of the app (android/ or the packages it is built with) changed since the ${record.runtimeVersion} APK,\n` +
      'and no version was cut for it. Such a change cannot reach an installed app by itself. Give it a version\n' +
      '(node bump-version.js patch --code+), land it, and hand out a new APK. Phones keep the update they have\n' +
      'until then.',
  );
}
const runtimeVersion = record.runtimeVersion;
const builtInto = runtimeVersionPlace.read(
  readFileSync(join(root, runtimeVersionPlace.file), 'utf8'),
);
if (builtInto !== runtimeVersion) {
  stop(
    `${runtimeVersionPlace.file} says an APK built here accepts updates for ${builtInto}, but ${native.RECORD} says ${runtimeVersion}.\n` +
      'Run bump-version.js, which sets both.',
  );
}

// ---- The files ---------------------------------------------------------------------------------------
const TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  json: 'application/json',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
};
const sha256 = data => createHash('sha256').update(data);
const md5 = data => createHash('md5').update(data).digest('hex');

const exported = JSON.parse(readFileSync(join(dist, 'metadata.json'), 'utf8'))
  .fileMetadata?.android;
if (!exported?.bundle) {
  stop(
    'dist/metadata.json has no Android bundle. Was the export made with --platform android?',
  );
}

const files = new Map(); // SHA-256 (hex) -> bytes: the same file is packed once
// key: the name the app's code knows the file by. The export names an image or font after the MD5 of its
//      bytes, and the app looks it up under that name.
// hash: what the phone checks the downloaded file against (SHA-256, base64url, no padding).
const describe = (path, key, contentType, fileExtension) => {
  const data = readFileSync(join(dist, path));
  if (!/^[0-9a-f]{32}$/.test(key)) {
    stop(`unexpected file name in the export: ${path}`);
  }
  if (fileExtension && !/^\.[a-z0-9]{1,10}$/i.test(fileExtension)) {
    stop(`unexpected file type in the export: ${path} (${fileExtension})`);
  }
  const digest = sha256(data).digest();
  files.set(digest.toString('hex'), data);
  return {
    key,
    hash: digest.toString('base64url'),
    contentType,
    ...(fileExtension ? { fileExtension } : {}),
  };
};

const launchAsset = describe(
  exported.bundle,
  md5(readFileSync(join(dist, exported.bundle))),
  'application/javascript',
);
const assets = exported.assets.map(({ path, ext }) =>
  describe(
    path,
    basename(path),
    TYPES[ext.toLowerCase()] ?? 'application/octet-stream',
    `.${ext}`,
  ),
);

// ---- The manifest --------------------------------------------------------------------------------------
const run = (command, args) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
const tryRun = (command, args) => {
  try {
    return run(command, args);
  } catch {
    return '';
  }
};
const commit = (
  process.env.RENDER_GIT_COMMIT || tryRun('git', ['rev-parse', 'HEAD'])
)
  .replace(/[^0-9a-f]/gi, '')
  .slice(0, 40);
// The app's public configuration, as the app reads it through expo-constants.
const expoClient = JSON.parse(
  run('npx', ['expo', 'config', '--type', 'public', '--json']),
);

const createdAt = new Date().toISOString();
// One checksum for what the update is: the backend keeps the update it already has when a later pack comes
// out the same (a push that changed no code), so the phones are not sent it twice.
const content = sha256(
  [
    launchAsset.hash,
    ...assets.map(a => `${a.key}${a.fileExtension} ${a.hash}`),
    JSON.stringify(expoClient),
  ].join('\n'),
).digest('hex');
// A new id on every pack, also for the same files: packing an earlier commit again is how an update is
// taken back, and the phones must see that as a newer update.
const idHex = sha256(`${content}\n${createdAt}`).digest('hex');
const id = `${idHex.slice(0, 8)}-${idHex.slice(8, 12)}-${idHex.slice(
  12,
  16,
)}-${idHex.slice(16, 20)}-${idHex.slice(20, 32)}`;

const manifest = {
  app,
  platform: 'android',
  id,
  createdAt,
  runtimeVersion,
  commit,
  content,
  launchAsset,
  assets,
  expoClient,
};

// ---- The archive: a plain tar (512-byte header per file, bytes padded to 512, two empty blocks), gzipped.
// Written here so the result does not depend on which tar program a computer has.
function header(name, size) {
  const bytes = Buffer.from(name);
  if (bytes.length > 100) {
    throw new Error(`file name too long for the archive: ${name}`);
  }
  const h = Buffer.alloc(512);
  bytes.copy(h, 0);
  h.write('0000644\0', 100);
  h.write('0000000\0', 108);
  h.write('0000000\0', 116);
  h.write(size.toString(8).padStart(11, '0') + '\0', 124);
  h.write('00000000000\0', 136);
  h.write('        ', 148);
  h.write('0', 156);
  h.write('ustar\0' + '00', 257);
  let sum = 0;
  for (const b of h) {
    sum += b;
  }
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return h;
}
const entries = [
  ['manifest.json', Buffer.from(JSON.stringify(manifest, null, 2))],
  ...[...files]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, data]) => [`files/${name}`, data]),
];
const parts = [];
for (const [name, data] of entries) {
  parts.push(
    header(name, data.length),
    data,
    Buffer.alloc((512 - (data.length % 512)) % 512),
  );
}
parts.push(Buffer.alloc(1024));
const archive = gzipSync(Buffer.concat(parts), { level: 9 });
const archiveSha256 = sha256(archive).digest('hex');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'update.tgz'), archive);
writeFileSync(
  join(out, 'update.json'),
  JSON.stringify(
    {
      app,
      platform: 'android',
      // What the backend names this build by: it changes whenever anything in the archive does.
      build: `${commit ? `${commit.slice(0, 10)}-` : ''}${archiveSha256.slice(
        0,
        10,
      )}`,
      id,
      runtimeVersion,
      commit,
      createdAt,
      content,
      sha256: archiveSha256,
      bytes: archive.length,
      files: files.size,
    },
    null,
    2,
  ) + '\n',
);
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Pinoy Ride: app updates</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f4f0; color: #1b1a16; font: 16px/1.5 system-ui, sans-serif; }
      main { max-width: 30rem; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
      p { margin: 0; color: #5c594f; }
    </style>
  </head>
  <body>
    <main>
      <h1>Nothing to open here</h1>
      <p>This address only holds the files the Pinoy Ride apps update themselves with. The apps fetch them through the Pinoy Ride backend.</p>
    </main>
  </body>
</html>
`,
);

console.log(
  `update-publish/: ${app} ${version} for apps installed from the ${runtimeVersion} APK on, ` +
    `update ${id.slice(0, 8)}${
      commit ? ` from commit ${commit.slice(0, 7)}` : ''
    }, ` +
    `${files.size} files, ${(archive.length / 1048576).toFixed(1)} MB`,
);
