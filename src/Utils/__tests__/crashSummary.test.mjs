import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Option J (A-211, plan A-205 v2 §1.2): a crash summary is exactly seven
// fields, never the message, the stack, a user, device or installation id;
// the app's own error handler still runs (chained). The same file in both apps.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const modulePath = join(root, 'src/Utils/crashSummary.js');
const reporterPath = join(root, 'src/Services/crashReporter.js');
const startPath = join(root, 'src/Services/crashSummaryStart.js');

const load = () => {
  assert.ok(existsSync(modulePath), 'src/Utils/crashSummary.js is missing');
  return require(modulePath);
};

const APP = { app: 'passenger', version: '2.0.116', build: 124 };
const NOW = new Date('2026-11-26T03:20:41.123Z');

// A Hermes release stack: one-line bundle, the column is the offset.
const HERMES = [
  "TypeError: Cannot read property 'name' of undefined (Juan Dela Cruz 09171234567)",
  '    at anonymous (native)',
  '    at apply (InternalBytecode.js:1:880)',
  '    at renderItem (address at /data/user/0/com.pinoyride.customer/files/.expo-internal/abc123:1:1234567)',
  '    at map (native)',
].join('\n');

test('a summary is exactly the seven fields, from the error class and the top frame', () => {
  const { summarize, FIELDS } = load();
  const error = new TypeError("Cannot read property 'name' of Juan 09171234567");
  error.stack = HERMES;
  const s = summarize(error, true, { ...APP, now: NOW });
  assert.deepEqual(s, {
    app: 'passenger',
    version: '2.0.116',
    build: 124,
    type: 'TypeError',
    frame: 1234567,
    fatal: true,
    hour: '2026-11-26T03',
  });
  assert.deepEqual(Object.keys(s).sort(), [...FIELDS].sort());
});

test('nothing of the message, the stack or the file path is in a summary', () => {
  const { summarize } = load();
  const error = new Error('Juan Dela Cruz 09171234567 juan@example.com');
  error.stack = HERMES;
  const text = JSON.stringify(summarize(error, false, { ...APP, now: NOW }));
  for (const leak of ['Juan', '0917', 'example', 'data/user', 'expo-internal', 'renderItem', 'Cannot']) {
    assert.ok(!text.includes(leak), `${leak} leaked: ${text}`);
  }
});

test('the error type is the class name, or a plain word', () => {
  const { errorType } = load();
  class PaymentFailed extends Error {}
  assert.equal(errorType(new RangeError('x')), 'RangeError');
  assert.equal(errorType(new PaymentFailed('x')), 'PaymentFailed');
  assert.equal(errorType('a thrown string with 09171234567'), 'string');
  assert.equal(errorType(42), 'number');
  assert.equal(errorType(undefined), 'Unknown');
  assert.equal(errorType(null), 'Unknown');
  assert.equal(errorType({}), 'Object');
  assert.equal(errorType(Object.create(null)), 'Error');
  // a name is never taken from .name, which code can set to anything
  const odd = new Error('x');
  odd.name = 'Juan Dela Cruz';
  assert.equal(errorType(odd), 'Error');
  const weird = { constructor: { name: 'has spaces and 0917' } };
  assert.equal(errorType(weird), 'Error');
  const throwing = {
    get constructor() {
      throw new Error('boom');
    },
  };
  assert.equal(errorType(throwing), 'Error');
});

test('the top frame is a bundle offset when known, otherwise 0', () => {
  const { topFrame } = load();
  assert.equal(topFrame(HERMES), 1234567);
  assert.equal(topFrame('Error: x\n    at f (index.android.bundle:1:42)'), 42);
  // a debug (Metro) bundle has many lines: no single offset
  assert.equal(
    topFrame('Error: x\n    at f (http://10.0.2.2:8081/index.bundle?platform=android&dev=true:3456:12)'),
    0,
  );
  assert.equal(topFrame('Error: x\n    at f (native)'), 0);
  assert.equal(topFrame(undefined), 0);
  assert.equal(topFrame(12), 0);
  assert.equal(topFrame(''), 0);
  assert.equal(topFrame('Error: x\n    at f (index.android.bundle:1:99999999999)'), 0);
});

test('the hour is UTC and coarse', () => {
  const { crashHour } = load();
  assert.equal(crashHour(new Date('2026-11-26T23:59:59.999+08:00')), '2026-11-26T15');
  assert.equal(crashHour(NOW), '2026-11-26T03');
});

test('no summary when the app numbers are not valid', () => {
  const { summarize } = load();
  const e = new Error('x');
  assert.equal(summarize(e, true, { ...APP, app: 'driver' }), null);
  assert.equal(summarize(e, true, { ...APP, version: undefined }), null);
  assert.equal(summarize(e, true, { ...APP, version: '2.1.17-beta' }), null);
  assert.equal(summarize(e, true, { ...APP, build: 0 }), null);
  assert.equal(summarize(e, true, { ...APP, build: '124' }), null);
  assert.equal(summarize(e, 'yes', APP).fatal, false);
});

test('each kind is sent once a start, at most three a start', () => {
  const { shouldSend, summarize, PER_START } = load();
  assert.equal(PER_START, 3);
  const sent = new Set();
  const at = frame => {
    const e = new TypeError('x');
    e.stack = `TypeError: x\n    at f (b:1:${frame})`;
    return summarize(e, false, { ...APP, now: NOW });
  };
  assert.equal(shouldSend(sent, at(1)), true);
  assert.equal(shouldSend(sent, at(1)), false, 'the same error in a loop is one report');
  assert.equal(shouldSend(sent, at(2)), true);
  assert.equal(shouldSend(sent, at(3)), true);
  assert.equal(shouldSend(sent, at(4)), false, 'three a start');
});

test('fatal summaries wait on the phone: the same one once, five at most, a week at most', () => {
  const { keepPending, stillSendable, summarize, KEEP } = load();
  assert.equal(KEEP, 5);
  const fatal = (frame, now = NOW) => {
    const e = new TypeError('x');
    e.stack = `TypeError: x\n    at f (b:1:${frame})`;
    return summarize(e, true, { ...APP, now });
  };
  let list = keepPending(null, fatal(1));
  list = keepPending(list, fatal(1));
  assert.equal(list.length, 1);
  for (let i = 2; i < 10; i++) {
    list = keepPending(list, fatal(i));
  }
  assert.equal(list.length, KEEP);
  assert.deepEqual(list.map(s => s.frame), [1, 2, 3, 4, 5]);
  // anything stored that is not exactly a summary is never sent
  const tampered = [...list, { ...fatal(7), message: 'Juan' }, 'x', null, { app: 'passenger' }];
  assert.equal(stillSendable(tampered, NOW).length, KEEP);
  const old = fatal(8, new Date('2026-11-18T03:00:00Z'));
  assert.deepEqual(stillSendable([old], NOW), []);
});

test('an answer settles a summary unless there was none, too many, or a server error', () => {
  const { answerSettles } = load();
  assert.equal(answerSettles(204), true);
  assert.equal(answerSettles(400), true, 'refused for good: never sent again');
  assert.equal(answerSettles(403), true);
  assert.equal(answerSettles(0), false);
  assert.equal(answerSettles(429), false);
  assert.equal(answerSettles(500), false);
  assert.equal(answerSettles(503), false);
});

test('the address is the API route', () => {
  const { crashReportAddress } = load();
  assert.equal(
    crashReportAddress('https://pinoyride-api-dev.onrender.com/api/'),
    'https://pinoyride-api-dev.onrender.com/api/app-errors',
  );
});

test('the handler that was there still runs: at once for an error, after the summary is kept for a crash', async () => {
  const { chainHandler } = load();
  const calls = [];
  let keep;
  const timers = [];
  const handler = chainHandler({
    previous: (error, isFatal) => calls.push(['previous', error.message, isFatal]),
    record: (error, isFatal) => {
      calls.push(['record', error.message, isFatal]);
      return isFatal ? new Promise(r => (keep = r)) : undefined;
    },
    waitMs: 800,
    later: (fn, ms) => timers.push([fn, ms]),
  });

  handler(new Error('soft'), false);
  assert.deepEqual(calls, [['record', 'soft', false], ['previous', 'soft', false]]);

  calls.length = 0;
  handler(new Error('hard'), true);
  assert.deepEqual(calls, [['record', 'hard', true]], 'a crash waits for the summary to be kept');
  keep();
  await new Promise(r => setImmediate(r));
  assert.deepEqual(calls, [['record', 'hard', true], ['previous', 'hard', true]]);
  assert.equal(timers[0][1], 800);
  timers[0][0](); // the time limit fires too: the old handler still runs once only
  assert.equal(calls.filter(c => c[0] === 'previous').length, 1);
});

test('a crash goes on after the time limit even when keeping the summary hangs', () => {
  const { chainHandler } = load();
  const calls = [];
  const timers = [];
  const handler = chainHandler({
    previous: () => calls.push('previous'),
    record: () => new Promise(() => {}),
    waitMs: 800,
    later: fn => timers.push(fn),
  });
  handler(new Error('hard'), true);
  assert.deepEqual(calls, []);
  timers[0]();
  assert.deepEqual(calls, ['previous']);
});

test('an error inside the summary never stops the old handler', async () => {
  const { chainHandler } = load();
  const calls = [];
  const handler = chainHandler({
    previous: (e, f) => calls.push(f),
    record: () => {
      throw new Error('broken');
    },
    waitMs: 800,
    later: () => {},
  });
  handler(new Error('soft'), false);
  handler(new Error('hard'), true);
  await new Promise(r => setImmediate(r));
  assert.deepEqual(calls, [false, true]);
  // and with no handler before it, nothing throws
  chainHandler({ previous: undefined, record: () => {}, waitMs: 1, later: () => {} })(new Error('x'), true);
});

// The wiring, read as text (it imports React Native modules).
test('the reporter chains the old handler and sends only the summary, with the app key', () => {
  assert.ok(existsSync(reporterPath), 'src/Services/crashReporter.js is missing');
  const src = readFileSync(reporterPath, 'utf8');
  assert.match(src, /getGlobalHandler\?\.\(\)/);
  assert.match(src, /previous: errorUtils\.getGlobalHandler/);
  assert.match(src, /body: JSON\.stringify\(summary\)/);
  assert.match(src, /'X-API-KEY': Constants\.API_KEY/);
  const code = src.replace(/\/\/.*$/gm, '');
  for (const never of [
    /\.message\b/,
    /DeviceInfo|getUniqueId|getAndroidId|installationId|deviceId/i,
    /customer|rider_id|userId|user_id|session/i,
    /X-Customer-Session|X-Rider-Session/,
    /\.stack\b/,
  ]) {
    assert.doesNotMatch(code, never, `the reporter must not use ${never}`);
  }
});

test('index.js installs it second, right after quietLogs, with this app\'s name', () => {
  const index = readFileSync(join(root, 'index.js'), 'utf8');
  const imports = [...index.matchAll(/^import\s+(?:[^'"]+from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1]);
  assert.equal(imports[0], './src/Utils/quietLogs');
  assert.equal(imports[1], './src/Services/crashSummaryStart');
  const pkg = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo.android.package;
  const app = pkg === 'com.pinoyride.rider' ? 'rider' : 'passenger';
  assert.match(readFileSync(startPath, 'utf8'), new RegExp(`installCrashSummary\\('${app}'\\);`));
});
