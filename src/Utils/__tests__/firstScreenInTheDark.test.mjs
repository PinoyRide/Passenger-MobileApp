// What a cold start shows before Home must be in the phone's look: on a dark
// phone no white screen after the dark native loading screen (QA UPD-14,
// 2026-11-25: the Passenger's first screen was a fixed white with the logo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = path =>
  readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8');
const FIXED_WHITE = /backgroundColor:\s*['"](white|#fff|#ffffff)['"]/i;

test('the first screen takes its background from the theme', () => {
  const splash = source('src/Screens/SplashScreen/SplashScreen.js');
  assert.doesNotMatch(splash, FIXED_WHITE);
  assert.match(splash, /backgroundColor: colors\.background/);
  assert.match(splash, /useTheme\(\)/);
});

test('what shows while the fonts load follows the phone', () => {
  const app = source('App.js');
  assert.doesNotMatch(app, FIXED_WHITE);
  assert.match(app, /const phone = useColorScheme\(\);/);
  assert.match(app, /phone === 'dark' \? 'rgb\(28, 27, 30\)' : '#FFFFFF'/);
});
