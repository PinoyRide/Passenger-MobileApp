import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The gold banner over the map ("Waiting for the Rider to accept your
// Booking", "Your Rider will pick you up at 7:30 AM") stood on the same line
// as "Riders nearby", which hid its first words (QA LAT-06, LAT-08, LAT-19,
// 2026-11-25). While the button shows, the banner sits above it.

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const home = readFileSync(
  join(app, 'src/Screens/HomeScreen/HomeScreen.js'),
  'utf8',
);
const px = expr => expr.split('+').reduce((sum, n) => sum + Number(n), 0);

test('"Riders nearby" shows while the booking sheet is up, 48 high, 16 off it', () => {
  assert.match(
    home,
    /\{sheetShown \? \(\s*<Pressable\s+onPress=\{toggleRiders\}/,
  );
  assert.match(
    home,
    /styles\.ridersButton,[\s\S]{0,80}\{ bottom: modalHeight \+ 16 \}/,
  );
  assert.match(home, /ridersButton: \{[^}]*height: 48,/);
});

test('the map banner clears the button while it shows', () => {
  const m = home.match(
    /const mapBannerBottom = modalHeight \+ \(sheetShown \? ([\d +]+) : (\d+)\);/,
  );
  assert.ok(m, 'mapBannerBottom follows sheetShown');
  assert.ok(px(m[1]) >= 16 + 48 + 4, `above the button: ${m[1]}`);
  assert.equal(Number(m[2]), 15);
  assert.match(home, /styles\.banner, \{ bottom: mapBannerBottom \}/);
  assert.doesNotMatch(home, /styles\.banner, \{ bottom: modalHeight \+ 15 \}/);
});
