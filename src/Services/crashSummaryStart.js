// Imported second in index.js, right after quietLogs, so the crash summary
// (src/Services/crashReporter.js, A-211) is in place before the rest of the
// app's code runs. This app's name is the one thing that differs from the
// other app.
import { installCrashSummary } from './crashReporter';

installCrashSummary('passenger');
