import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Help in an emergency, in both apps (the owner, 2026-11-23: "check why the
// rider app does not have emergency assistance": the Rider's Account page was
// drawn from the Passenger's without it). The same file in both apps
// (sharedUi.test.mjs).

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');

test('the Account page offers Emergency assistance, which opens the 911 dialog', () => {
  const account = read('src/Screens/SettingsScreen/SettingsScreen.js');
  assert.match(account, /title="Emergency assistance"/);
  assert.match(account, /<SafetyGuideModal/);
  assert.match(account, /setShowSafetyGuide\(true\)/);
});

test('the map has the Emergency button during a trip', () => {
  assert.match(
    read('src/Screens/HomeScreen/HomeScreen.js'),
    /<EmergencyButton\b/,
  );
});

test('the number is the Philippine emergency hotline', () => {
  assert.match(
    read('src/Components/EmergencyCall/emergencyCall.js'),
    /EMERGENCY_NUMBER = '911'/,
  );
});
