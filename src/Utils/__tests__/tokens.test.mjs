import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOLD, ON_GOLD, modern } from '../../Theme/modern.js';

// One look for both apps, light and dark (A-184, approved by the owner on
// 2026-11-26; design/A-184/SPEC.md section 2 and 5): one gold, near-black
// words on it, one name for each colour, and every pair of words and fill
// readable. Contrast is computed here (WCAG 2.x relative luminance), not
// copied from the spec: 4.5:1 or more for words, 3:1 for edges and icons.
// The same file in both apps (sharedUi.test.mjs).

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');

// --- colour arithmetic ---------------------------------------------------

const parse = colour => {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb =
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
      colour,
    );
  assert.ok(rgb, `cannot read the colour ${colour}`);
  return [+rgb[1], +rgb[2], +rgb[3], rgb[4] === undefined ? 1 : +rgb[4]];
};

// a see-through colour as it shows on what lies under it
const over = (colour, under) => {
  const [r, g, b, a] = parse(colour);
  const [R, G, B] = parse(under);
  const mix = (x, y) => Math.round(x * a + y * (1 - a));
  return `rgb(${mix(r, R)}, ${mix(g, G)}, ${mix(b, B)})`;
};

const luminance = colour => {
  const [r, g, b, a] = parse(colour);
  assert.equal(a, 1, `${colour} is see-through: lay it over its fill first`);
  const channel = c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('the arithmetic matches WCAG: black on white is 21:1, gold A words 10.9:1', () => {
  assert.equal(contrast('#000000', '#FFFFFF').toFixed(2), '21.00');
  assert.equal(contrast('#17171C', '#FEC107').toFixed(2), '10.93');
  assert.equal(over('rgba(0, 0, 0, 0.5)', '#FFFFFF'), 'rgb(128, 128, 128)');
});

// --- the two looks, from this app's own theme files ----------------------

// a theme file's `colors: { key: '...' }`, as written
const themeValue = (path, key) => {
  const found = new RegExp(`\\n\\s+${key}:\\s*'([^']+)'`).exec(read(path));
  assert.ok(found, `${path} has no ${key}`);
  return found[1];
};

const LOOKS = {
  light: 'src/Theme/LightTheme.js',
  dark: 'src/Theme/DarkTheme.js',
};

const lookOf = name =>
  modern({
    dark: name === 'dark',
    colors: {
      background: themeValue(LOOKS[name], 'background'),
      text: themeValue(LOOKS[name], 'text'),
    },
  });

// [words or edge, fill, the least ratio, what it is]; a see-through fill is
// laid over the card it sits on
const WORDS = 4.5;
const EDGE = 3;
const pairs = t => [
  ...['page', 'surface', 'card', 'soft'].flatMap(fill => [
    ['ink', fill, WORDS, 'titles, body'],
    ['inkSoft', fill, WORDS, 'second lines'],
    ['muted', fill, WORDS, 'captions, the version line'],
  ]),
  ['onAccent', 'accent', WORDS, 'words on the gold'],
  [
    'onAccent',
    over(t.goldShade, t.accent),
    WORDS,
    'Cash in pill on the gold card',
  ],
  ...['page', 'surface', 'card'].map(fill => [
    'chipInk',
    fill,
    WORDS,
    'links, "Resend code"',
  ]),
  ['chipInk', over(t.chip, t.card), WORDS, 'gold icon on its patch'],
  ['success', over(t.onSuccess, t.card), WORDS, 'good-news pill'],
  ...['page', 'surface', 'card'].map(fill => [
    'red',
    fill,
    WORDS,
    'errors, destructive words',
  ]),
  ['red', over(t.redSoft, t.card), WORDS, 'cancelled pill'],
  ['surface', 'red', WORDS, 'words on the Emergency fill'],
  ...['page', 'surface', 'card'].flatMap(fill => [
    ['fieldEdge', fill, EDGE, 'field and checkbox edge (C-5)'],
    ['pickup', fill, EDGE, 'the pick-up pin'],
  ]),
];

for (const name of Object.keys(LOOKS)) {
  test(`${name} look: every pair of words and fill reads`, () => {
    const t = lookOf(name);
    const colour = key => (key in t ? t[key] : key);
    const weak = pairs(t)
      .map(([front, back, least, use]) => {
        const ratio = contrast(colour(front), colour(back));
        return { front, back, least, use, ratio: +ratio.toFixed(2) };
      })
      .filter(({ ratio, least }) => ratio < least);
    assert.deepEqual(weak, [], `too faint in the ${name} look`);
  });

  test(`${name} look: one gold, near-black words on it`, () => {
    const t = lookOf(name);
    assert.equal(t.accent, '#FEC107');
    assert.equal(t.onAccent, '#17171C');
  });

  test(`${name} look: a retired name is only another name for its new one`, () => {
    const t = lookOf(name);
    const retired = {
      gold: 'accent',
      onGold: 'onAccent',
      onGoldSoft: 'onAccent',
      danger: 'red',
      link: 'pickup',
      switchOff: 'fieldEdge',
      radius: 'radiusTile',
    };
    for (const [old, now] of Object.entries(retired)) {
      assert.equal(t[old], t[now], `${old} must be ${now}`);
    }
  });
}

test('the new names are all there, in both looks', () => {
  for (const name of Object.keys(LOOKS)) {
    const t = lookOf(name);
    for (const key of [
      'page',
      'surface',
      'card',
      'soft',
      'tile',
      'hairline',
      'fieldEdge',
      'ink',
      'inkSoft',
      'muted',
      'faint',
      'accent',
      'onAccent',
      'chip',
      'chipInk',
      'success',
      'onSuccess',
      'red',
      'redSoft',
      'pickup',
      'route',
      'scrim',
      'goldShade',
      'radiusSheet',
      'radiusCard',
      'radiusTile',
      'radiusButton',
      'radiusPill',
    ]) {
      assert.ok(t[key] !== undefined, `${name} look has no ${key}`);
    }
  }
});

test('the brand gold is gold A and the words on it near-black (C-1)', () => {
  assert.equal(GOLD, '#FEC107');
  assert.equal(ON_GOLD, '#17171C');
});

// --- the theme files follow modern.js -----------------------------------

test('LightTheme and DarkTheme take the gold and the words on it from modern.js', () => {
  for (const path of Object.values(LOOKS)) {
    const text = read(path);
    assert.match(text, /import \{ GOLD, ON_GOLD \} from '\.\/modern';/, path);
    assert.match(text, /\n\s+primary: GOLD,/, `${path}: primary`);
    assert.match(text, /\n\s+brand: GOLD,/, `${path}: brand`);
    assert.match(text, /\n\s+onYellow: ON_GOLD,/, `${path}: onYellow`);
    assert.doesNotMatch(
      text,
      /#372A00|#FFCD05|#E8BF46/i,
      `${path}: an old gold`,
    );
    assert.doesNotMatch(
      text,
      /Avenir LT Std 65 Medium/,
      `${path}: a font never loaded`,
    );
    assert.match(text, /fontFamily: 'Poppins Regular'/, `${path}: font`);
  }
  const light = read(LOOKS.light);
  if (/ON_PRIMARY_BUTTON_TEXT/.test(light)) {
    assert.match(light, /export const ON_PRIMARY_BUTTON_TEXT = ON_GOLD;/);
  }
});

// --- nothing in the code goes round the tokens --------------------------

const sources = (dir = join(app, 'src')) =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sources(path);
    }
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [path] : [];
  });

const lines = pattern =>
  [...sources(), join(app, 'App.js')]
    .filter(file => existsSync(file))
    .flatMap(file =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => [line, i + 1])
        .filter(([line]) => pattern.test(line))
        .map(([line, n]) => `${relative(app, file)}:${n} ${line.trim()}`),
    );

test('no hard-coded old gold or old words-on-gold brown: use GOLD / ON_GOLD', () => {
  assert.deepEqual(lines(/#FFC107|#372A00|#352B08|#6B5619|#F5C344/i), []);
});

test('no Poppins Light (C-8), and no font that is never loaded', () => {
  assert.deepEqual(lines(/Poppins Light|Poppins-Light/), []);
  const loaded = new Set(
    [...read('App.js').matchAll(/\n\s+'([^']+)': require\(/g)].map(m => m[1]),
  );
  const used = new Set(
    lines(/fontFamily:\s*'[^']+'/).map(
      line => /fontFamily:\s*'([^']+)'/.exec(line)[1],
    ),
  );
  assert.deepEqual(
    [...used].filter(font => !loaded.has(font)),
    [],
    'a font name App.js does not load falls back to the phone font',
  );
  assert.deepEqual(
    [...used].filter(
      font =>
        !['Poppins Regular', 'Poppins Medium', 'Poppins SemiBold'].includes(
          font,
        ),
    ),
    [],
    'Regular, Medium and SemiBold only (C-8)',
  );
});
