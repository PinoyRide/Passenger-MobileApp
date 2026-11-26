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

// Every <AlertBox> is given only the props AlertBox takes. React drops a
// prop it does not know without a word: the Rider's camera and location
// boxes and the Passenger's location box were given cancelText / onCancel
// (Alert.alert's word is a 'cancel' button; AlertBox's is secondaryText /
// onSecondary), so "Later" never showed and Back was the only way out (UX
// review A-184, 2026-11-26).
const ALERT_BOX = 'src/Components/AlertBox/AlertBox.js';

const alertBoxProps = () => {
  const source = readFileSync(join(app, ALERT_BOX), 'utf8');
  const params = source.match(/const AlertBox = \(\{([^}]*)\}\)/);
  assert.ok(params, `${ALERT_BOX}: const AlertBox = ({ ...props }) not found`);
  return new Set(
    params[1]
      .split(',')
      .map(part => part.split('=')[0].trim())
      .filter(Boolean),
  );
};

// the props written on each <AlertBox ...> tag: what stands at the tag's own
// level once every {...} value and "..." string is blanked out
const tagsIn = source => {
  const tags = [];
  const start = /<AlertBox\b/g;
  let found;
  while ((found = start.exec(source))) {
    let depth = 0;
    let quote = null;
    let own = '';
    for (let i = found.index + found[0].length; i < source.length; i += 1) {
      const ch = source[i];
      if (quote) {
        if (ch === quote) quote = null;
        own += ' ';
        continue;
      }
      if (depth === 0 && (ch === '"' || ch === "'")) {
        quote = ch;
        own += ' ';
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (depth === 0 && ch === '>') break;
      own += depth === 0 && ch !== '}' ? ch : ' ';
    }
    tags.push({
      line: source.slice(0, found.index).split('\n').length,
      props: own.match(/[A-Za-z_$][\w$]*/g) || [],
    });
  }
  return tags;
};

test('every <AlertBox> is given only the props AlertBox takes', () => {
  const known = alertBoxProps();
  // the button names are in it (secondaryText, not cancelText)
  assert.ok(known.has('secondaryText') && known.has('onSecondary'));
  const wrong = sources().flatMap(file => {
    const rel = relative(app, file);
    return tagsIn(readFileSync(file, 'utf8')).flatMap(({ line, props }) =>
      props
        .filter(prop => !known.has(prop) && prop !== 'key')
        .map(prop => `${rel}:${line} ${prop}`),
    );
  });
  assert.deepEqual(
    wrong,
    [],
    `AlertBox takes ${[...known].join(
      ', ',
    )}: a second button is secondaryText / onSecondary`,
  );
});
