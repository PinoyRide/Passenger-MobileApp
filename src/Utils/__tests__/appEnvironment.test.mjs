import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Module, { createRequire } from 'node:module';

// Develop or Sandbox, chosen by the installed app's own id (A-342 / A-345):
// ".sandbox" talks to the Sandbox API; ".dev", the Play ids and anything else
// keep today's Develop address; an id that cannot be read means Develop,
// never Sandbox. The same file in both apps (sharedUi.test.mjs).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const modulePath = join(root, 'src/Utils/appEnvironment.js');
const read = path => readFileSync(join(root, path), 'utf8');

const DEVELOP_API = 'https://pinoyride-api-dev.onrender.com/api/';
const SANDBOX_API = 'https://pinoyride-api-sandbox.onrender.com/api/';

const load = () => {
  assert.ok(existsSync(modulePath), 'src/Utils/appEnvironment.js is missing');
  return require(modulePath);
};

// A fresh copy of the module, with react-native-device-info replaced by
// `device` (an object, or a function that throws) for that one load.
const loadWithDevice = device => {
  delete require.cache[require.resolve(modulePath)];
  const original = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'react-native-device-info') {
      if (typeof device === 'function') {
        return device();
      }
      return device;
    }
    return original.call(this, request, ...rest);
  };
  try {
    const fresh = require(modulePath);
    const first = fresh.appEnvironment();
    // a second ask is answered from the first read
    assert.equal(fresh.appEnvironment(), first);
    return first;
  } finally {
    Module._load = original;
    delete require.cache[require.resolve(modulePath)];
  }
};

test('a ".sandbox" app talks to the Sandbox API', () => {
  const { environmentFor, apiBaseFor, SANDBOX, SANDBOX_API: api } = load();
  assert.equal(api, SANDBOX_API);
  for (const id of [
    'com.pinoyride.customer.sandbox',
    'com.pinoyride.rider.sandbox',
  ]) {
    assert.equal(environmentFor(id), SANDBOX, id);
    assert.equal(apiBaseFor(environmentFor(id), DEVELOP_API), SANDBOX_API, id);
  }
});

test('a ".dev" app keeps the Develop address it is given', () => {
  const { environmentFor, apiBaseFor, DEVELOP } = load();
  for (const id of ['com.pinoyride.customer.dev', 'com.pinoyride.rider.dev']) {
    assert.equal(environmentFor(id), DEVELOP, id);
    assert.equal(apiBaseFor(environmentFor(id), DEVELOP_API), DEVELOP_API, id);
  }
  // a local DEV_URL (never committed) is kept as it is too
  const local = 'http://10.0.2.2:5000/api/';
  assert.equal(
    apiBaseFor(environmentFor('com.pinoyride.rider.dev'), local),
    local,
  );
});

test('the Play ids (no suffix) keep today’s behaviour: the Develop address', () => {
  const { environmentFor, apiBaseFor, DEVELOP } = load();
  for (const id of ['com.pinoyride.customer', 'com.pinoyride.rider']) {
    assert.equal(environmentFor(id), DEVELOP, id);
    assert.equal(apiBaseFor(environmentFor(id), DEVELOP_API), DEVELOP_API, id);
  }
});

test('an id that cannot be read, or is anything else, means Develop, never Sandbox', () => {
  const { environmentFor, apiBaseFor, DEVELOP } = load();
  for (const id of [
    undefined,
    null,
    '',
    'unknown', // what react-native-device-info answers on an unknown platform
    42,
    {},
    ['com.pinoyride.rider.sandbox'],
    'com.pinoyride.rider.sandboxx',
    'com.pinoyride.rider.sandbox ',
    'com.pinoyride.rider.SANDBOX',
    'com.pinoyride.ridersandbox',
    'com.pinoyride.rider.sandbox.dev',
  ]) {
    assert.equal(environmentFor(id), DEVELOP, String(id));
    assert.equal(apiBaseFor(environmentFor(id), DEVELOP_API), DEVELOP_API);
  }
  // an environment the helper does not know is not Sandbox either
  assert.equal(apiBaseFor(undefined, DEVELOP_API), DEVELOP_API);
  assert.equal(apiBaseFor('Sandbox', DEVELOP_API), DEVELOP_API);
});

test('the version line says Develop or Sandbox', () => {
  const { environmentLabel, DEVELOP, SANDBOX } = load();
  assert.equal(environmentLabel(DEVELOP), 'Develop');
  assert.equal(environmentLabel(SANDBOX), 'Sandbox');
  assert.equal(environmentLabel(undefined), 'Develop');
  assert.equal(environmentLabel('production'), 'Develop');
});

test('the installed id is read from react-native-device-info, once', () => {
  let reads = 0;
  const device = id => ({
    getBundleId: () => {
      reads += 1;
      return id;
    },
  });
  assert.equal(loadWithDevice(device('com.pinoyride.customer.sandbox')), 'sandbox');
  assert.equal(loadWithDevice({ default: device('com.pinoyride.rider.sandbox') }), 'sandbox');
  assert.equal(loadWithDevice(device('com.pinoyride.rider.dev')), 'develop');
  assert.equal(loadWithDevice(device('com.pinoyride.customer')), 'develop');
  assert.equal(reads, 4);
});

test('without the native module, or when it throws, the app is Develop', () => {
  assert.equal(
    loadWithDevice(() => {
      throw new Error('no native module');
    }),
    'develop',
  );
  assert.equal(
    loadWithDevice({
      getBundleId: () => {
        throw new Error('not ready');
      },
    }),
    'develop',
  );
  assert.equal(loadWithDevice({}), 'develop');
  // node itself has no react-native-device-info that loads
  assert.equal(load().appEnvironment(), 'develop');
});

test('Constants.js keeps the Develop DEV_URL and takes the API base from the switch', () => {
  const constants = read('src/Utils/Constants.js');
  assert.match(
    constants,
    /const DEV_URL = 'https:\/\/pinoyride-api-dev\.onrender\.com\/api\/';/,
  );
  assert.match(
    constants,
    /BASE_URI: IS_DEV \? apiBaseFor\(ENVIRONMENT, DEV_URL\) : PROD_URL,/,
  );
  assert.match(constants, /const ENVIRONMENT = appEnvironment\(\);/);
  assert.match(constants, /ENVIRONMENT_LABEL,/);
  assert.doesNotMatch(constants, /sandbox\.onrender/);
});

test('the Sandbox address lives in appEnvironment.js only', () => {
  const files = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name !== '__tests__') {
          walk(path);
        }
      } else if (/\.(js|jsx|ts|tsx)$/.test(name)) {
        files.push(path);
      }
    }
  };
  walk(join(root, 'src'));
  const holders = files
    .filter(path => read(relative(root, path)).includes('pinoyride-api-sandbox'))
    .map(path => relative(root, path));
  assert.deepEqual(holders, ['src/Utils/appEnvironment.js']);
});

test('the first screen and Settings show the environment, never a fixed "Develop"', () => {
  for (const screen of [
    'src/Screens/Login/LandingScreen.js',
    'src/Screens/SettingsScreen/AccountSettingsScreen.js',
  ]) {
    const source = read(screen);
    assert.match(source, /AppConstants\.ENVIRONMENT_LABEL/, screen);
    assert.doesNotMatch(source, /' · Develop'/, screen);
  }
});
