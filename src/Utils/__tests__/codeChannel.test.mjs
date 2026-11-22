import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../codeChannel.js';
const { offersEmail, maskedMobile, emailChoice, sentTo } = mod;

test('email is offered only when the backend names it', () => {
  assert.equal(offersEmail({ channels: ['sms', 'email'], emailHint: 'j•••@gmail.com' }), true);
  assert.equal(offersEmail({ channels: ['sms'], emailHint: null }), false);
  assert.equal(offersEmail(undefined), false);
  assert.equal(offersEmail({}), false);
});

test('a number shows only its last four digits, however it was typed', () => {
  assert.equal(maskedMobile('639175550102'), '+63 ••• ••• 0102');
  assert.equal(maskedMobile('0917-555-0102'), '+63 ••• ••• 0102');
});

test('the email choice is always shown: usable with an address, greyed out without', () => {
  assert.deepEqual(emailChoice({ channels: ['sms', 'email'], emailHint: 'j•••@gmail.com' }), {
    available: true,
    detail: 'j•••@gmail.com',
  });
  assert.deepEqual(emailChoice({ channels: ['sms'], emailHint: null }), {
    available: false,
    detail: 'No email on this account',
  });
});

test('the code screen says where the code went', () => {
  assert.equal(
    sentTo({ channel: 'email', emailHint: 'j•••@gmail.com', mobileNumber: '9175550102' }),
    'A One-Time PIN was sent to j•••@gmail.com',
  );
  assert.equal(
    sentTo({ channel: 'sms', mobileNumber: '9175550102' }),
    'A One-Time PIN was sent to +63 ••• ••• 0102',
  );
  assert.match(sentTo({ channel: 'sms', mobileNumber: '9175550102', handed: true }), /Test environment/);
});
