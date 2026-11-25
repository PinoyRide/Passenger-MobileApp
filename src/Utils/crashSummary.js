// A crash summary for the API (option J, A-211): when the app's JavaScript
// fails, it tells Pinoy Ride WHAT kind of error and WHERE in the app's code,
// and nothing else. Pure (no RN imports) so it runs under `node --test`;
// src/Services/crashReporter.js wires it to React Native's global error
// handler. The same file in both apps (sharedUi.test.mjs).
//
// What is sent, exactly these seven fields (the API refuses anything else):
//   app      'passenger' or 'rider'
//   version  the real version (2.0.116), as the app sends it everywhere
//   build    the build number (APP_BUILD)
//   type     the error's class name (TypeError), never its message
//   frame    the top stack frame as an offset into the JavaScript bundle
//            (Hermes release bundles are one line: the column is the offset);
//            0 when it is not known
//   fatal    whether the error ended the app
//   hour     the hour it happened, UTC (2026-11-26T03): a coarse time only
// Never the message, the stack, a user, phone, device or installation id:
// the message can hold a name or a number, the stack a file path.

const TYPE = /^[A-Za-z0-9_.$]{1,80}$/;
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,4}$/;
const APPS = ['passenger', 'rider'];
const MAX_FRAME = 2147483647;

// At most this many summaries are sent in one run of the app, each kind
// (type, frame, fatal) once: an error in a loop is one report.
const PER_START = 3;
// At most this many fatal summaries wait on the phone for the next start.
const KEEP = 5;
// The API takes an hour at most a week old (AppErrorReport.OldestHour).
const OLDEST_MS = 7 * 24 * 60 * 60 * 1000;

function errorType(error) {
  let name;
  try {
    if (error === null || error === undefined) {
      return 'Unknown';
    }
    name =
      typeof error === 'object' || typeof error === 'function'
        ? error.constructor && error.constructor.name
        : typeof error;
  } catch (e) {
    name = undefined;
  }
  return typeof name === 'string' && TYPE.test(name) ? name : 'Error';
}

// The top frame's offset in the bundle: the column of the first frame that
// points into code (`at f (…:1:12345)`), when its line is 1, as in a Hermes
// release bundle. Anything else is 0. Only that number leaves this function.
const FRAME = /^\s*at .*:(\d+):(\d+)\)?\s*$/;
const NOT_CODE = /\((native|\[native code\])\)|InternalBytecode\.js/;

function topFrame(stack) {
  if (typeof stack !== 'string') {
    return 0;
  }
  const lines = stack.slice(0, 4000).split('\n').slice(0, 30);
  for (const line of lines) {
    if (NOT_CODE.test(line)) {
      continue;
    }
    const match = FRAME.exec(line);
    if (match) {
      const column = Number(match[2]);
      return match[1] === '1' && Number.isSafeInteger(column) && column <= MAX_FRAME
        ? column
        : 0;
    }
  }
  return 0;
}

function crashHour(date) {
  return date.toISOString().slice(0, 13);
}

// The summary of `error`, or null when the app's own numbers are not valid
// (nothing is sent then).
function summarize(error, isFatal, { app, version, build, now = new Date() }) {
  if (
    !APPS.includes(app) ||
    typeof version !== 'string' ||
    !VERSION.test(version) ||
    !Number.isSafeInteger(build) ||
    build < 1 ||
    build > 999999
  ) {
    return null;
  }
  let stack;
  try {
    stack = error && error.stack;
  } catch (e) {
    stack = undefined;
  }
  return {
    app,
    version,
    build,
    type: errorType(error),
    frame: topFrame(stack),
    fatal: isFatal === true,
    hour: crashHour(now),
  };
}

const summaryKey = s => `${s.type}@${s.frame}@${s.fatal ? 1 : 0}`;

// Whether to send this summary in this run; remembers it in `sent` (a Set).
function shouldSend(sent, summary) {
  const key = summaryKey(summary);
  if (sent.has(key) || sent.size >= PER_START) {
    return false;
  }
  sent.add(key);
  return true;
}

// The waiting list with `summary` added: the same kind in the same hour is
// kept once, and at most KEEP are kept (the oldest first).
function keepPending(pending, summary) {
  const list = Array.isArray(pending) ? pending.filter(isSummary) : [];
  const same = s =>
    summaryKey(s) === summaryKey(summary) &&
    s.hour === summary.hour &&
    s.version === summary.version &&
    s.build === summary.build;
  if (list.some(same) || list.length >= KEEP) {
    return list;
  }
  return [...list, summary];
}

// Those of the waiting list the API still takes (a week at most).
function stillSendable(pending, now = new Date()) {
  const list = Array.isArray(pending) ? pending.filter(isSummary) : [];
  return list.filter(
    s => now.getTime() - Date.parse(`${s.hour}:00:00Z`) < OLDEST_MS,
  );
}

const FIELDS = ['app', 'version', 'build', 'type', 'frame', 'fatal', 'hour'];

// A stored summary is used only when it is exactly the seven fields.
function isSummary(s) {
  return (
    s !== null &&
    typeof s === 'object' &&
    Object.keys(s).length === FIELDS.length &&
    FIELDS.every(f => f in s) &&
    APPS.includes(s.app) &&
    VERSION.test(String(s.version)) &&
    TYPE.test(String(s.type)) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(String(s.hour))
  );
}

// Whether an answer settles the summary: sent (2xx) or refused for good
// (4xx). Kept for the next start: no connection (0), too many (429), or the
// API not answering properly (5xx).
function answerSettles(status) {
  return (
    Number.isInteger(status) &&
    status >= 200 &&
    status < 500 &&
    status !== 429
  );
}

function crashReportAddress(baseUri) {
  return `${baseUri}app-errors`;
}

// The global error handler: counts the error (record, which may be async)
// and always passes it on to the handler that was there before, so the app
// behaves as before. A fatal error waits for `record` at most `waitMs`, so
// its summary can be kept before the app closes; any other error is passed
// on at once. An error inside this handler never stops the chain.
function chainHandler({ previous, record, waitMs, later = setTimeout }) {
  let busy = false;
  return (error, isFatal) => {
    let recorded = Promise.resolve();
    if (!busy) {
      busy = true;
      try {
        recorded = Promise.resolve(record(error, isFatal));
      } catch (e) {
        recorded = Promise.resolve();
      } finally {
        busy = false;
      }
    }
    if (typeof previous !== 'function') {
      return;
    }
    if (!isFatal) {
      previous(error, isFatal);
      return;
    }
    let passed = false;
    const pass = () => {
      if (!passed) {
        passed = true;
        previous(error, isFatal);
      }
    };
    later(pass, waitMs);
    recorded.then(pass, pass);
  };
}

module.exports = {
  PER_START,
  KEEP,
  FIELDS,
  errorType,
  topFrame,
  crashHour,
  summarize,
  shouldSend,
  keepPending,
  stillSendable,
  isSummary,
  answerSettles,
  crashReportAddress,
  chainHandler,
};
