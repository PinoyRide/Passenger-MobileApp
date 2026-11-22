import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../codeChannel.js';
const { offersEmail, sentTo } = mod;

test('email is offered only when the backend names it', () => {
  assert.equal(offersEmail({ channels: ['sms', 'email'], emailHint: 'j•••@gmail.com' }), true);
  assert.equal(offersEmail({ channels: ['sms'], emailHint: null }), false);
  assert.equal(offersEmail(null), false);
  assert.equal(offersEmail({}), false);
});

test('the code screen says where the code went', () => {
  assert.equal(
    sentTo({ channel: 'email', emailHint: 'j•••@gmail.com', mobileNumber: '639171234567' }),
    'A One-Time PIN was sent to j•••@gmail.com',
  );
  assert.equal(
    sentTo({ channel: 'sms', mobileNumber: '639171234567' }),
    'A One-Time PIN was sent to +63 ******4567',
  );
});

test('a code handed to the app (a test environment) says so, whatever the channel', () => {
  assert.match(sentTo({ channel: 'sms', mobileNumber: '639171234567', handed: true }), /Test environment/);
});
