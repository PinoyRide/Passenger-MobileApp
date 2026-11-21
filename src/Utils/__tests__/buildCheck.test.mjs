import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../buildCheck.js';
const { TIMEOUT_MS, buildCheckAddress, buildRequired } = mod;

const FOLDER = 'https://drive.google.com/drive/folders/builds';
const tooOld = {
  success: true,
  data: { updateRequired: true, minimumVersion: '2.0.8', updateLink: FOLDER },
};
const fine = {
  success: true,
  data: { updateRequired: false, minimumVersion: '2.0.8', updateLink: null },
};

test('the question names the app and the installed build', () => {
  assert.equal(
    buildCheckAddress('https://api.example.test/api/', 'rider', '2.0.5'),
    'https://api.example.test/api/app-updates/rider/build?version=2.0.5',
  );
  // no version: the backend then requires nothing
  assert.equal(
    buildCheckAddress('https://api.example.test/api/', 'passenger', undefined),
    'https://api.example.test/api/app-updates/passenger/build?version=',
  );
});

test('an install that is too old is sent to the download as the app opens', () => {
  assert.deepEqual(buildRequired(tooOld), {
    updateLink: FOLDER,
    minimumVersion: '2.0.8',
  });
});

test('an install that is new enough goes on', () => {
  assert.equal(buildRequired(fine), null);
});

test('a trip under way is not interrupted', () => {
  assert.equal(buildRequired(tooOld, { tripUnderWay: true }), null);
});

test('an answer that cannot be read never shuts the person out', () => {
  for (const body of [
    null,
    undefined,
    {},
    { success: false, errors: [{ message: 'no such app' }] },
    { data: { updateRequired: 'yes', updateLink: FOLDER } },
    { data: { updateRequired: true } }, // nowhere to send them
    { data: { updateRequired: true, updateLink: '' } },
  ]) {
    assert.equal(buildRequired(body), null, JSON.stringify(body));
  }
});

test('the app waits a moment for the answer, and no longer', () => {
  assert.ok(TIMEOUT_MS >= 1000 && TIMEOUT_MS <= 4000, `${TIMEOUT_MS}`);
});
