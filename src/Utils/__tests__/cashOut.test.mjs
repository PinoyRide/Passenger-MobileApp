import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../cashOut.js';
const {
  GCASH,
  mobileNumber,
  bankAccountNumber,
  accountError,
  accountName,
  accountNameError,
  channelsFrom,
  freshChannel,
  markLetter,
  cashOutRequest,
  maskedAccount,
  afterCashOut,
} = mod;

const answered = data => ({
  response: { status: 'success', code: 200, message: data.message, data },
  error: null,
});

const MAYA = { code: 'PAYMAYA', name: 'Maya', payMethod: 'EWALLET', isBank: false, logo: null };
const BPI = { code: 'BPI', name: 'BPI', payMethod: 'BANK', isBank: true, logo: null };
const LOGO = 'https://pinoyride-api-dev.onrender.com/payout-logos/gcash.png';

test('an e-wallet account is its mobile number, read as 09XXXXXXXXX', () => {
  assert.equal(mobileNumber('0917 123 4567'), '09171234567');
  assert.equal(mobileNumber('+63 917 123 4567'), '09171234567');
  assert.equal(accountError(MAYA, '0917-123-4567'), '');
  assert.match(accountError(MAYA, '0917123'), /11-digit/);
  assert.match(accountError(GCASH, ''), /mobile number/);
});

test('a bank account number is 6 to 30 digits', () => {
  assert.equal(bankAccountNumber('0012 3456-7890'), '001234567890');
  assert.equal(accountError(BPI, '0012 3456 7890'), '');
  assert.match(accountError(BPI, '12345'), /6 to 30/);
  assert.match(accountError(BPI, '12A4567'), /digits/);
  assert.match(accountError(BPI, ' '), /account number/);
});

test('the account name is the person name, at most 30 characters', () => {
  assert.equal(accountName('Juan', 'Dela Cruz'), 'Juan Dela Cruz');
  assert.equal(accountName('Maximiliano Bartolome', 'Dela Cruz Santos').length, 30);
  assert.equal(accountNameError('  Juan  Dela Cruz '), '');
  assert.match(accountNameError(''), /name on the account/);
  assert.match(accountNameError('x'.repeat(31)), /At most 30/);
});

test("the channels: PayCools' e-wallets in order, banks by name, none under maintenance", () => {
  const { ewallets, banks } = channelsFrom([
    { code: 'BDO', name: 'Banco de Oro', pay_method: 'BANK', is_bank: true, is_maintenance: false },
    { code: 'GCASH', name: 'GCash', pay_method: 'EWALLET', is_bank: false, is_maintenance: false },
    { code: 'BPI', name: 'BPI', pay_method: 'BANK', is_bank: true, is_maintenance: false },
    { code: 'PAYMAYA', name: 'Maya', pay_method: 'EWALLET', is_bank: false, is_maintenance: false },
    { code: 'XYZ', name: 'Down Bank', pay_method: 'BANK', is_bank: true, is_maintenance: true },
  ]);
  assert.deepEqual(ewallets.map(c => c.code), ['GCASH', 'PAYMAYA']);
  assert.deepEqual(banks.map(c => c.code), ['BDO', 'BPI']);
  assert.deepEqual(banks[1], BPI);
  assert.deepEqual(channelsFrom(null), { ewallets: [], banks: [] });
});

test('a channel shows its logo when the list names a web address for it, a lettered tile otherwise', () => {
  const { ewallets, banks } = channelsFrom([
    { code: 'GCASH', name: 'GCash', pay_method: 'EWALLET', is_bank: false, logo_url: LOGO },
    { code: 'PAYMONGO', name: 'PayMongo', pay_method: 'EWALLET', is_bank: false, logo_url: null },
    { code: 'BDO', name: 'Banco de Oro', pay_method: 'BANK', is_bank: true, logo_url: 'javascript:alert(1)' },
  ]);
  assert.equal(ewallets[0].logo, LOGO);
  assert.equal(ewallets[1].logo, null);
  assert.equal(banks[0].logo, null);
  assert.equal(GCASH.logo, null);
  assert.equal(markLetter('Banco de Oro'), 'B');
  assert.equal(markLetter('(Cotabato) Rural Bank'), 'C');
  assert.equal(markLetter(''), '•');
});

test('the chosen channel takes its logo once the list is in', () => {
  const channels = channelsFrom([
    { code: 'GCASH', name: 'GCash', pay_method: 'EWALLET', is_bank: false, logo_url: LOGO },
  ]);
  assert.equal(freshChannel(channels, GCASH).logo, LOGO);
  assert.equal(freshChannel(channels, BPI), BPI);
  assert.equal(freshChannel(channels, null), null);
});

test('the request carries the channel and the account in the fields the backend reads', () => {
  assert.deepEqual(cashOutRequest({ amount: 150.5, channel: GCASH, account: '0917 123 4567', name: ' Juan  Dela Cruz ' }), {
    destination_bank_code: 'GCASH',
    pay_method: 'EWALLET',
    destination_acct_no: '09171234567',
    destination_acct_name: 'Juan Dela Cruz',
    amount: '150.5',
  });
  assert.deepEqual(cashOutRequest({ amount: 2000, channel: BPI, account: '0012-3456-7890', name: 'Juan Dela Cruz' }), {
    destination_bank_code: 'BPI',
    pay_method: 'BANK',
    destination_acct_no: '001234567890',
    destination_acct_name: 'Juan Dela Cruz',
    amount: '2000',
  });
});

test('the confirmation shows only the last four digits', () => {
  assert.equal(maskedAccount(GCASH, '0917 123 4567'), '•••• 4567');
  assert.equal(maskedAccount(BPI, '0012-3456-7890'), '•••• 7890');
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
