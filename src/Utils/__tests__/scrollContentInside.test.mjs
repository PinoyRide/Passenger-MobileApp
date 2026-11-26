// A scrolling list's content must stay inside the list (WALLET-CLIP,
// 2026-11-26). Android's ScrollView always clips what it draws to its own
// edges, so a negative side margin on `contentContainerStyle` pushes the
// content past them and the edges are cut off: the Wallet page lost its card
// corners, the T of "TRANSACTIONS" and the l of "See all". A page whose
// cards sit closer to the edge than the Container's 20 widens the list
// itself instead (`style={styles.scrollArea}` with the negative margin, as
// Settings and Cash out do).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const srcDir = join(appRoot, 'src');

const sourceFiles = dir =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === 'node_modules'
        ? []
        : sourceFiles(path);
    }
    return /\.(js|jsx|ts|tsx)$/.test(name) ? [path] : [];
  });

// the text between `open` at `from` and its matching closing brace
const balanced = (text, from) => {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    if (text[i] === '{') {
      depth += 1;
    } else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(from + 1, i);
      }
    }
  }
  return '';
};

const NEGATIVE_SIDE =
  /\bmargin(Horizontal|Left|Right|Start|End)?\s*:\s*-\s*[\d.]/;

// every style a contentContainerStyle in this file uses, with where it is
const contentStyles = text => {
  const found = [];
  const attr = /contentContainerStyle\s*=\s*\{/g;
  let m;
  while ((m = attr.exec(text))) {
    const value = balanced(text, m.index + m[0].length - 1);
    found.push({ name: '(inline)', body: value });
    for (const ref of value.matchAll(/\bstyles\.(\w+)/g)) {
      const def = new RegExp(`\\n\\s*${ref[1]}\\s*:\\s*\\{`).exec(text);
      if (def) {
        found.push({
          name: `styles.${ref[1]}`,
          body: balanced(text, def.index + def[0].length - 1),
        });
      }
    }
  }
  return found;
};

test('no scrolling content is pushed past the list edges', () => {
  const offenders = [];
  for (const file of sourceFiles(srcDir)) {
    const text = readFileSync(file, 'utf8');
    for (const { name, body } of contentStyles(text)) {
      if (NEGATIVE_SIDE.test(body)) {
        offenders.push(`${relative(appRoot, file)}: ${name}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'a negative side margin on contentContainerStyle is cut off by the ' +
      "list's edges; put it on the list's own style instead",
  );
});

test('the Wallet page widens the list, not its content', () => {
  const text = readFileSync(
    join(srcDir, 'Screens', 'WalletScreen', 'WalletScreen.js'),
    'utf8',
  );
  assert.match(text, /<ScrollView\s+style=\{styles\.scrollArea\}/);
  assert.match(text, /scrollArea:\s*\{\s*marginHorizontal:\s*-4\s*\}/);
});
