import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The Passenger's Add Saved Place search became the shared search pieces
// (A-328: the Rider's Home Address uses them too). It is a move only: the
// Passenger's screen keeps every word, its distances, and today's search
// (one letter asks, no limit on calls).

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const screen = readFileSync(
  join(app, 'src/Screens/Location/SaveLocationScreen.js'),
  'utf8',
);

test('Add Saved Place searches with the shared pieces, not its own copy', () => {
  assert.match(screen, /import usePlaceSearch from '@\/Hooks\/usePlaceSearch'/);
  assert.match(
    screen,
    /import PlaceSearchBar from '@\/Components\/PlaceSearch\/PlaceSearchBar'/,
  );
  assert.match(
    screen,
    /import PlaceResultRow from '@\/Components\/PlaceSearch\/PlaceResultRow'/,
  );
  assert.doesNotMatch(screen, /const ResultRow\b/);
  assert.doesNotMatch(screen, /setTimeout\(/, 'the pause lives in the hook');
});

test('it keeps its words and its distances', () => {
  for (const words of [
    'No places found. Try another name, or tap the map.',
    'Use my current location',
    'Type the name of a place, a building or a street.',
    'Search for a place or address',
    'Place not found',
    'distanceLabel(',
  ]) {
    assert.ok(screen.includes(words), words);
  }
});

test('it keeps today\'s search: any letter asks, with no limit', () => {
  assert.doesNotMatch(screen, /minLength/);
  assert.doesNotMatch(screen, /maxCalls/);
});
