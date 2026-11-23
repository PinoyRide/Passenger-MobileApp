import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Dark mode (Settings > Dark mode, the owner, 2026-11-23: "in rider
// profile>settings we have a dark mode but not implemented in passenger").
// What turned screens unreadable in the dark look when it came, kept from
// coming back.

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

// White kept on purpose: the start screen matches the white loading screen
// before it (android launch_background, a new APK to change), and these
// boxes carry their own dark words.
const WHITE_ON_PURPOSE = new Set([
  'src/Screens/SplashScreen/SplashScreen.js',
  'src/Screens/Login/UpdateRequiredScreen.js',
  'src/Services/Push/PushNotificationManager.js',
  // a step dot on the black camera screen
  'src/Screens/Profile/LivenessSelfieScreen.js',
]);

test('nothing else is painted white whatever the look', () => {
  const white = lines(
    /backgroundColor:\s*['"](#fff|#ffffff|white)['"]/i,
  ).filter(line => !WHITE_ON_PURPOSE.has(line.split(':')[0]));
  assert.deepEqual(
    white,
    [],
    'a white card stays white in the dark look and hides theme-coloured words on it: use colors.card or modern.js',
  );
});

test('the app follows the chosen look: theme, navigator and status bar', () => {
  const root = read('App.js');
  assert.match(root, /<ThemeProvider>/);
  assert.match(root, /<StatusBar style=\{isDark \? 'light' : 'dark'\} \/>/);
  const navigator = read('src/Navigators/Application.js');
  assert.match(navigator, /<PaperProvider theme=\{theme\}>/);
  assert.doesNotMatch(navigator, /theme=\{LightTheme\}/);
  assert.match(
    read('src/Screens/SettingsScreen/AccountSettingsScreen.js'),
    /<ThemeSwitch \/>/,
  );
});
