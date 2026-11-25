// Words in a dialog must be readable on the dark theme's background (QA UI-06, 2026-11-25: the Delete
// vehicle box's "Delete" was dark grey on the dark card). Every dialog (a <Modal>) that takes a text colour
// from the theme is checked against DarkTheme.js: the words need a contrast of at least 3:1 with the dark
// background. Words on a yellow button (onYellow and the like) sit on yellow, not on the background.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../', import.meta.url));
const dark = readFileSync(join(src, 'Theme/DarkTheme.js'), 'utf8');
const theme = {};
for (const m of dark.matchAll(/^\s*([A-Za-z0-9_]+):\s*'([^']+)'/gm)) {
  theme[m[1]] = m[2];
}

const rgb = c => {
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(c);
  return m ? m[1].split(',').map(Number).slice(0, 3) : null;
};
const lum = ([r, g, b]) => {
  const f = v => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const ON_A_BUTTON = /^(onYellow|onPrimary|.*ButtonText|.*OnButton)$/;

const files = [];
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === '__tests__' || name === 'node_modules') {
      continue;
    }
    if (statSync(path).isDirectory()) {
      walk(path);
    } else if (name.endsWith('.js') && /<Modal\b/.test(readFileSync(path, 'utf8'))) {
      files.push(path);
    }
  }
};
walk(src);

test('there are dialogs to check', () => {
  assert.ok(files.length > 0);
});

test('every theme colour for words in a dialog is readable in the dark', () => {
  const background = rgb(theme.background);
  const unreadable = [];
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const m = /\bcolor:\s*colors\.([A-Za-z0-9_]+)/.exec(line);
        if (!m || ON_A_BUTTON.test(m[1]) || !theme[m[1]]) {
          return;
        }
        const c = rgb(theme[m[1]]);
        if (c && contrast(c, background) < 3) {
          unreadable.push(`${file.slice(src.length)}:${i + 1} colors.${m[1]} ${theme[m[1]]}`);
        }
      });
  }
  assert.deepEqual(unreadable, []);
});
