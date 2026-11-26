// Which phone a request comes from (the owner, A-316, 2026-11-26: "already
// logged in" after reinstalling the app). Every request carries X-Device-Id:
// Android's ANDROID_ID (react-native-device-info getUniqueId, read through
// AppUtil.getPlatformUniqueId), the same for every app signed with one key on
// one phone and kept through an uninstall. The API keeps only its hash with
// each sign-in: a sign-in from the same phone takes over the old one (the app
// was reinstalled), another phone is still refused (backend SignInGate,
// Legacy/Accounts/DeviceId.cs). A sign-in made before the header is recorded by
// its first request that carries it.
//
// The id is read once and kept for the life of the app. deviceIdHeader() is
// synchronous: until the first read has finished it gives nothing (and starts
// the read). The request builders that sign in (Services/Api.js, ApiV2.js)
// wait for it first (waitForDeviceId), so a code and a sign-in carry it.
//
// The same file in both apps (sharedUi.test.mjs). Pure apart from the default
// reader, which requires AppUtil only when called, so node --test can load it.

const DEVICE_ID_HEADER = 'X-Device-Id';

// Longer values are not an id: the API ignores them too
const MAX_LENGTH = 128;

// The id as it is sent, or null when there is no usable one (none, blank,
// too long, or the "unknown" device-info answers when it cannot read it).
function usableDeviceId(id) {
  if (typeof id !== 'string') {
    return null;
  }
  const trimmed = id.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_LENGTH ||
    trimmed.toLowerCase() === 'unknown'
  ) {
    return null;
  }
  return trimmed;
}

// The header for an id: empty when there is no usable id.
function deviceIdHeaderFor(id) {
  const usable = usableDeviceId(id);
  return usable === null ? {} : { [DEVICE_ID_HEADER]: usable };
}

function readUniqueId() {
  const loaded = require('./AppUtil');
  const AppUtil = loaded?.default ?? loaded;
  return AppUtil.getPlatformUniqueId();
}

// null: not read yet; '' : read, no usable id; otherwise the id
let cached = null;
let pending = null;
let reader = readUniqueId;

// Reads the id once; later calls give the kept one. A failed read is tried
// again by the next call. Never throws.
function readyDeviceId() {
  if (cached !== null) {
    return Promise.resolve(cached);
  }
  if (pending === null) {
    pending = Promise.resolve()
      .then(() => reader())
      .then(
        id => {
          cached = usableDeviceId(id) ?? '';
          pending = null;
          return cached;
        },
        () => {
          pending = null;
          return '';
        },
      );
  }
  return pending;
}

// readyDeviceId(), but never waits longer than ms: a request is never held
// back by the read (it then goes without the header, as before).
function waitForDeviceId(ms = 2000) {
  let timer = null;
  const late = new Promise(resolve => {
    timer = setTimeout(() => resolve(''), ms);
  });
  return Promise.race([readyDeviceId(), late]).finally(() =>
    clearTimeout(timer),
  );
}

// The header every request carries (spread next to appBuildHeader()).
function deviceIdHeader() {
  if (cached === null) {
    readyDeviceId();
  }
  return deviceIdHeaderFor(cached);
}

// Tests only: forget the kept id and read with another reader.
function resetDeviceIdForTests(read = readUniqueId) {
  cached = null;
  pending = null;
  reader = read;
}

module.exports = {
  DEVICE_ID_HEADER,
  usableDeviceId,
  deviceIdHeaderFor,
  readyDeviceId,
  waitForDeviceId,
  deviceIdHeader,
  resetDeviceIdForTests,
};
