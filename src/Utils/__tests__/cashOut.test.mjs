import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../cashOut.js';
const { gcashNumber, gcashNumberError, accountName, cashOutRequest, afterCashOut } = mod;

const answered = data => ({
  response: { status: 'success', code: 200, message: data.message, data },
  error: null,
});

test('GCash numbers are read as 09XXXXXXXXX', () => {
  assert.equal(gcashNumber('0917 123 4567'), '09171234567');
  assert.equal(gcashNumber('+63 917 123 4567'), '09171234567');
  assert.equal(gcashNumberError('0917-123-4567'), '');
  assert.match(gcashNumberError(''), /Enter your GCash number/);
  assert.match(gcashNumberError('0917123'), /11-digit/);
  assert.match(gcashNumberError('08171234567'), /11-digit/);
});

test('the account name is the rider name, at most 30 characters', () => {
  assert.equal(accountName(' Juan ', 'Dela  Cruz'), 'Juan Dela Cruz');
  assert.equal(
    accountName('Maria Clarissa Josephine', 'Santos-Villanueva'),
    'Maria Clarissa Josephine Santo',
  );
  assert.equal(accountName('', 'Reyes'), 'Reyes');
});

test('the request is a GCash cash-out in the fields the backend reads', () => {
  assert.deepEqual(
    cashOutRequest({ amount: 150.5, number: '0917 123 4567', firstName: 'Juan', lastName: 'Dela Cruz' }),
    {
      destination_bank_code: 'GCASH',
      pay_method: 'EWALLET',
      destination_acct_no: '09171234567',
      destination_acct_name: 'Juan Dela Cruz',
      amount: '150.5',
    },
  );
});

test('a cash-out PayCools has taken is processing, not done', () => {
  const next = afterCashOut(
    answered({ status: 'processing', reference_id: 'PRCO1', amount: 150, message: 'Cash out is processing' }),
    150,
  );
  assert.deepEqual(next, { complete: { status: 'processing', reference: 'PRCO1', amount: 150 } });
});

test('a paid-out cash-out is completed', () => {
  assert.equal(afterCashOut(answered({ status: 'completed', reference_id: 'PRCO1' }), 10).complete.status, 'completed');
});

test('a refusal stays on the screen with its reason', () => {
  const next = afterCashOut(
    { response: null, error: 'Cash-out is not available yet', errorCode: 503 },
    150,
  );
  assert.deepEqual(next, { refusal: 'Cash-out is not available yet' });
  assert.match(afterCashOut(answered({ status: 'failed', message: 'Cash out failed; the amount is back in your wallet' }), 1).refusal, /back in your wallet/);
});

test('an update screen or a newer request takes over', () => {
  assert.deepEqual(afterCashOut({ forceUpdate: true }), {});
  assert.deepEqual(afterCashOut({ stale: true }), {});
  assert.deepEqual(afterCashOut(null), {});
});
