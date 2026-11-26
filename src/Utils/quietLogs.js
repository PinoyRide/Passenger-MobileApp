// Release builds write nothing with console.log: the logs carried a
// passenger's name, number and photo, trip points and live positions to the
// phone's system log (overnight review 2026-11-23). Debug builds (Metro, the
// emulator bench) log as before; warnings and errors are kept. Imported first
// in index.js, so it is in place before anything else runs. The same file in
// both apps.
if (!__DEV__) {
  // eslint-disable-next-line no-console
  console.log = () => {};
}
