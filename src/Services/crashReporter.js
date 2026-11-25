import AsyncStorage from '@react-native-async-storage/async-storage';
import ExpoConstants from 'expo-constants';
// straight from its file: index.js loads this before the rest of the app
import Constants from '@/Utils/Constants';
import { APP_BUILD } from '@/Utils/appBuild';
import {
  PER_START,
  answerSettles,
  chainHandler,
  crashReportAddress,
  keepPending,
  shouldSend,
  stillSendable,
  summarize,
} from '@/Utils/crashSummary';

// Crash summaries (option J, A-211): the app tells the API what kind of
// error happened and where in the code (src/Utils/crashSummary.js says
// exactly what is sent, and what never is). Installed as the app starts
// (src/Services/crashSummaryStart.js, imported second in index.js), in front
// of the global error handler that was there, which still runs every time:
// the app crashes, or shows the error, exactly as before.
//
// An error that does not end the app is sent at once. A fatal one is kept on
// the phone (at most 5), the usual crash follows (after at most 0.8 s), and
// it is sent at the next start, 10 s in. Best effort: no answer in 4 s, or no
// connection, and it waits for the next start; a summary the API refuses is
// dropped. At most 3 are sent a start. The same file in both apps.

const PENDING = 'crashSummaries.pending';
const SEND_TIMEOUT_MS = 4000;
const FATAL_WAIT_MS = 800;
const PENDING_AFTER_MS = 10000;

let installed = false;
const sent = new Set();

const appNumbers = app => ({
  app,
  version: ExpoConstants.expoConfig?.version,
  build: APP_BUILD,
});

// The HTTP status of the answer, or 0 when there was none.
async function send(summary) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const answer = await fetch(crashReportAddress(Constants.BASE_URI), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': Constants.API_KEY,
      },
      body: JSON.stringify(summary),
    });
    return answer.status;
  } catch (e) {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

async function readPending() {
  try {
    const raw = await AsyncStorage.getItem(PENDING);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

async function writePending(list) {
  try {
    if (list.length === 0) {
      await AsyncStorage.removeItem(PENDING);
    } else {
      await AsyncStorage.setItem(PENDING, JSON.stringify(list));
    }
  } catch (e) {
    // nothing to do: the summary is lost, the app is not affected
  }
}

async function record(app, error, isFatal) {
  const summary = summarize(error, isFatal, appNumbers(app));
  if (!summary) {
    return;
  }
  if (isFatal) {
    await writePending(keepPending(await readPending(), summary));
    return;
  }
  if (shouldSend(sent, summary)) {
    await send(summary);
  }
}

async function sendPending() {
  const waiting = stillSendable(await readPending());
  const left = [];
  for (const summary of waiting) {
    if (sent.size >= PER_START || !shouldSend(sent, summary)) {
      left.push(summary);
      continue;
    }
    if (!answerSettles(await send(summary))) {
      left.push(summary);
    }
  }
  await writePending(left);
}

export function installCrashSummary(app) {
  const errorUtils = global.ErrorUtils;
  if (installed || !errorUtils?.setGlobalHandler) {
    return;
  }
  installed = true;
  errorUtils.setGlobalHandler(
    chainHandler({
      previous: errorUtils.getGlobalHandler?.(),
      record: (error, isFatal) => record(app, error, isFatal),
      waitMs: FATAL_WAIT_MS,
    }),
  );
  setTimeout(() => {
    sendPending().catch(() => {});
  }, PENDING_AFTER_MS);
}
