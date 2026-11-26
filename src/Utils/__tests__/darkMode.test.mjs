import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Dark mode (Settings > Dark mode, the owner, 2026-11-23: "in rider
// profile>settings we have a dark mode but not implemented in passenger").
// What turned screens unreadable in the dark look when it came, kept from
// coming back. The same file in both apps since A-184 piece a (2026-11-26,
// sharedUi.test.mjs): the Rider app is held to it too.

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');

const sources = (dir = join(app, 'src')) =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sources(path);
    }
    return path.endsWith('.js') ? [path] : [];
  });

const lines = (pattern, files = sources()) =>
  files.flatMap(file =>
    readFileSync(file, 'utf8')
      .split('\n')
      .map((line, i) => [line, i + 1])
      .filter(([line]) => pattern.test(line))
      .map(([line, n]) => `${relative(app, file)}:${n} ${line.trim()}`),
  );

// the top-level keys of a theme file's `colors: { ... }`
const colourKeys = path => {
  const text = read(path);
  const start = text.indexOf('colors: {');
  assert.ok(start >= 0, `${path} has no colors`);
  const keys = [];
  let depth = 0;
  for (let i = start + 'colors: {'.length - 1; i < text.length; i++) {
    if (text[i] === '{') {
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        break;
      }
    } else if (depth === 1) {
      const key = /^\n\s*([A-Za-z0-9_]+)\s*:/.exec(text.slice(i, i + 80));
      if (key) {
        keys.push(key[1]);
      }
    }
  }
  return keys;
};

test('the dark look has every colour the light look has', () => {
  const light = colourKeys('src/Theme/LightTheme.js');
  const dark = new Set(colourKeys('src/Theme/DarkTheme.js'));
  assert.ok(light.length > 30, `read only ${light.length} light colours`);
  assert.deepEqual(
    light.filter(key => !dark.has(key)),
    [],
    'a colour missing in DarkTheme.js is undefined in the dark look',
  );
});

test('words are not drawn in colors.shadow (black in both looks)', () => {
  assert.deepEqual(
    lines(
      /(^|[^A-Za-z])color:\s*colors\.shadow\b|textColor=\{colors\.shadow\}/,
    ),
    [],
    'use colors.text: shadow stays black on the dark page',
  );
});

test('cards and pages are not painted colors.onPrimary (white in both looks)', () => {
  assert.deepEqual(
    lines(/backgroundColor:\s*colors\.onPrimary\b/),
    [],
    'use colors.card for a card, colors.background for a page',
  );
});

// White kept on purpose: these boxes carry their own dark words. Paths of
// both apps (the file is shared); a path the app does not have is skipped.
// (The start screen left the list when it took the phone's look, QA UPD-14;
// Update needed when it took modern.js, A-184 piece f.)
const WHITE_ON_PURPOSE = new Set([
  'src/Services/Push/PushNotificationManager.js',
  // a step dot on the black camera screen (Passenger, Rider)
  'src/Screens/Profile/LivenessSelfieScreen.js',
  'src/Screens/Register/LivenessSelfieScreen.js',
  // Rider boxes with their own dark words on white, until A-184 piece c2
  // draws them as the AlertBox; take each off this list then
  'src/Components/AlertBox/PickupWarningModal.js',
  'src/Screens/AdvanceBookingScreen/CancelPenaltyModal.js',
  'src/Screens/AdvanceBookingScreen/EmergencyCancelModals.js',
]);

const WHITE = /backgroundColor:\s*['"](#fff|#ffffff|white)['"]/i;

test('nothing else is painted white whatever the look', () => {
  const white = lines(WHITE).filter(
    line => !WHITE_ON_PURPOSE.has(line.split(':')[0]),
  );
  assert.deepEqual(
    white,
    [],
    'a white card stays white in the dark look and hides theme-coloured words on it: use colors.card or modern.js',
  );
});

test('the white kept on purpose is still there (an emptied file leaves the list)', () => {
  const stale = [...WHITE_ON_PURPOSE].filter(
    path => existsSync(join(app, path)) && !WHITE.test(read(path)),
  );
  assert.deepEqual(
    stale,
    [],
    'no white left in these: take them off WHITE_ON_PURPOSE',
  );
});

test('the app follows the chosen look: theme, navigator and status bar', () => {
  const root = read('App.js');
  assert.match(root, /<ThemeProvider>/);
  assert.match(root, /<StatusBar style=\{isDark \? 'light' : 'dark'\} \/>/);
  const navigator = read('src/Navigators/Application.js');
  // the Passenger app wraps its navigator in Paper's provider, the Rider app
  // its whole root: either way the chosen theme, never the light one
  assert.match(root + navigator, /<PaperProvider theme=\{theme\}>/);
  assert.doesNotMatch(root + navigator, /theme=\{LightTheme\}/);
  assert.match(
    navigator,
    /<NavigationContainer\s+theme=\{(theme|navigationTheme)\}/,
  );
  assert.match(
    read('src/Screens/SettingsScreen/AccountSettingsScreen.js'),
    /<ThemeSwitch \/>/,
  );
});
