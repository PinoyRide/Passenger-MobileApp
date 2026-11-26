import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// The same phone may sign in again (the owner, A-316): every request says
// which phone it comes from, X-Device-Id, Android's ANDROID_ID read through
// AppUtil.getPlatformUniqueId (Utils/deviceIdHeader.js). The same file in
// both apps (sharedUi.test.mjs).

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const read = file => readFileSync(join(app, file), 'utf8');
const load = () => require(join(app, 'src/Utils/deviceIdHeader.js'));

const sources = (dir = join(app, 'src')) =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sources(path);
    }
    return path.endsWith('.js') ? [relative(app, path)] : [];
  });

test('the header is X-Device-Id, with the id as read, trimmed', () => {
  const { DEVICE_ID_HEADER, deviceIdHeaderFor } = load();
  assert.equal(DEVICE_ID_HEADER, 'X-Device-Id');
  assert.deepEqual(deviceIdHeaderFor('a1b2c3d4e5f60718'), {
    'X-Device-Id': 'a1b2c3d4e5f60718',
  });
  assert.deepEqual(deviceIdHeaderFor(' a1b2c3d4e5f60718 '), {
    'X-Device-Id': 'a1b2c3d4e5f60718',
  });
});

test('no usable id, no header', () => {
  const { deviceIdHeaderFor } = load();
  for (const id of [
    undefined,
    null,
    '',
    '   ',
    'unknown',
    'UNKNOWN',
    'a'.repeat(129),
    42,
    {},
  ]) {
    assert.deepEqual(deviceIdHeaderFor(id), {}, `${String(id)}`);
  }
});

test('the id is read once, then kept; the header waits for nothing', async () => {
  const { readyDeviceId, deviceIdHeader, resetDeviceIdForTests } = load();
  let reads = 0;
  resetDeviceIdForTests(async () => {
    reads += 1;
    return 'a1b2c3d4e5f60718';
  });
  // before the first read has finished: nothing yet, and the read starts
  assert.deepEqual(deviceIdHeader(), {});
  assert.equal(await readyDeviceId(), 'a1b2c3d4e5f60718');
  assert.deepEqual(deviceIdHeader(), { 'X-Device-Id': 'a1b2c3d4e5f60718' });
  await readyDeviceId();
  assert.equal(reads, 1);
  resetDeviceIdForTests();
});

test('a failed read sends no header and is tried again', async () => {
  const { readyDeviceId, deviceIdHeader, resetDeviceIdForTests } = load();
  let fail = true;
  resetDeviceIdForTests(async () => {
    if (fail) {
      throw new Error('no device info');
    }
    return 'a1b2c3d4e5f60718';
  });
  assert.equal(await readyDeviceId(), '');
  assert.deepEqual(deviceIdHeader(), {});
  fail = false;
  assert.equal(await readyDeviceId(), 'a1b2c3d4e5f60718');
  assert.deepEqual(deviceIdHeader(), { 'X-Device-Id': 'a1b2c3d4e5f60718' });
  resetDeviceIdForTests();
});

test('a read that hangs never holds a request back', async () => {
  const { waitForDeviceId, resetDeviceIdForTests } = load();
  resetDeviceIdForTests(() => new Promise(() => {}));
  assert.equal(await waitForDeviceId(20), '');
  resetDeviceIdForTests();
});

test('the id comes from AppUtil.getPlatformUniqueId (DeviceInfo.getUniqueId)', () => {
  assert.match(
    read('src/Utils/deviceIdHeader.js'),
    /require\('\.\/AppUtil'\)[\s\S]*getPlatformUniqueId\(\)/,
  );
  assert.match(
    read('src/Utils/AppUtil.js'),
    /getPlatformUniqueId: async function \(\) \{\s*return await DeviceInfo\.getUniqueId\(\);/,
  );
});

// The crash reporter is the one exception: a crash summary carries no id of
// the person or the phone (A-211, crashSummary.test.mjs), and it signs no one in.
const NO_PHONE_ID = ['src/Services/crashReporter.js'];

test('every request that says its build also says its phone', () => {
  const withBuild = sources().filter(
    file =>
      !NO_PHONE_ID.includes(file) &&
      /\.\.\.appBuildHeader\(\)/.test(read(file)),
  );
  assert.ok(withBuild.length >= 3, 'the request builders were not found');
  const left = withBuild.filter(
    file => !/\.\.\.deviceIdHeader\(\)/.test(read(file)),
  );
  assert.deepEqual(left, [], 'spread deviceIdHeader() into these headers');
  for (const file of NO_PHONE_ID) {
    assert.doesNotMatch(read(file), /deviceIdHeader/, file);
  }
});

test('the shared request builder waits for the id, so a sign-in carries it', () => {
  const text = read('src/Services/Api.js');
  const wait = text.indexOf('await waitForDeviceId()');
  assert.ok(wait > 0, 'Services/Api.js must wait for the id');
  assert.ok(
    wait < text.indexOf('...deviceIdHeader()'),
    'the wait comes before the headers are built',
  );
});
