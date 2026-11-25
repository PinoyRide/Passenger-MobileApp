import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Every question in the app's look (the owner, 2026-11-23: "Alerts &
// notifications: one component, three shapes"): through Utils/appAlert.js,
// which draws the AlertBox, not the platform's Alert.alert. The same file in
// both apps (sharedUi.test.mjs).

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// where the platform dialog stays: appAlert itself (a chooser of three
// answers, or nothing on screen to draw), and the background location task,
// which runs with no screen
const PLATFORM_ON_PURPOSE = new Set([
  'src/Utils/appAlert.js',
  'src/Services/backgroundLocationTask.js',
]);

const sources = (dir = join(app, 'src')) =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sources(path);
    }
    return path.endsWith('.js') ? [path] : [];
  });

// Alert.alert, or the bare global alert(), which React Native draws as the
// same platform dialog, titled "Alert" and white in Dark mode (QA, Passenger
// 2.0.102: Confirm with no place chosen on Select Location). window.alert in
// a react-native-web branch is the browser's own and is left alone.
const PLATFORM_DIALOG = /Alert\.alert\(|(^|[^.\w$])alert\(/m;

test('no platform dialog outside appAlert', () => {
  const left = sources()
    .map(file => relative(app, file))
    .filter(file => !PLATFORM_ON_PURPOSE.has(file))
    .filter(file =>
      PLATFORM_DIALOG.test(readFileSync(join(app, file), 'utf8')),
    );
  assert.deepEqual(
    left,
    [],
    'use appAlert (Utils/appAlert.js): the same arguments, drawn as the AlertBox',
  );
});

test('the host that draws them is mounted once, inside the theme', () => {
  const roots = ['App.js', 'src/Navigators/Application.js']
    .map(file => readFileSync(join(app, file), 'utf8'))
    .join('\n');
  assert.equal((roots.match(/<AlertHost \/>/g) || []).length, 1);
});
