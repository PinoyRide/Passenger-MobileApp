import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import mod from '../cashOut.js';
const {
  GCASH,
  MINIMUM_CASH_OUT,
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
  CASH_OUT_TIMEOUT_MS,
  nextResultCheck,
  cashOutOutcome,
  cashOutResultText,
  resultOnScreen,
  watchResultPushes,
  resultPageSaysIt,
  cashOutPushOnPage,
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

test('the smallest cash-out is ₱15, as the backend has it', () => {
  assert.equal(MINIMUM_CASH_OUT, 15);
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

// Overnight review 2026-11-23: a slow cash-out timed out on the phone as
// "No internet connection" while it went through, and a second press sent a
// second one.
test('a cash-out with no answer may have gone through: check before sending again', () => {
  const next = afterCashOut({ response: null, error: 'No internet connection.', offline: true }, 150);
  assert.match(next.refusal, /may have gone through/);
  assert.match(next.refusal, /before you try again/);
});

test('a cash-out waits longer for its answer than other requests', () => {
  assert.ok(CASH_OUT_TIMEOUT_MS >= 60000);
});

// The review of 2026-11-24: an offline press was told "may have gone
// through" although nothing was sent.
test('a cash-out never sent (no connection) says so, not "may have gone through"', () => {
  const next = afterCashOut(
    { response: null, error: 'No internet connection.', offline: true, notSent: true },
    150,
  );
  assert.equal(next.refusal, 'No internet connection.');
  assert.doesNotMatch(next.refusal, /may have gone through/);
});

// The result page, 2026-11-24: it stayed on "processing" after the cash-out
// was paid out or had come back. Now it follows the cash-out by itself.
test('the result page asks every 5 s for 3 minutes, then every 30 s, and stops after 15 minutes', () => {
  assert.equal(nextResultCheck(0), 5000);
  assert.equal(nextResultCheck(179999), 5000);
  assert.equal(nextResultCheck(180000), 30000);
  assert.equal(nextResultCheck(14 * 60 * 1000), 30000);
  assert.equal(nextResultCheck(15 * 60 * 1000), null);
  // a clock that went backwards, or no time yet: ask soon
  assert.equal(nextResultCheck(-50), 5000);
  assert.equal(nextResultCheck(undefined), 5000);
});

test('only "completed" and "failed" end the wait; anything else is still processing', () => {
  assert.equal(cashOutOutcome({ status: 'completed' }), 'completed');
  assert.equal(cashOutOutcome({ status: 'FAILED' }), 'failed');
  assert.equal(cashOutOutcome({ status: 'processing' }), 'processing');
  assert.equal(cashOutOutcome({ status: 'pending' }), 'processing');
  assert.equal(cashOutOutcome({}), 'processing');
  assert.equal(cashOutOutcome(null), 'processing');
});

test('the result page says sent, did not go through (with the amount back), or processing', () => {
  assert.deepEqual(cashOutResultText('completed', '₱15.00'), {
    title: 'Cash out sent',
    note: 'It was paid out to your account.',
  });
  assert.deepEqual(cashOutResultText('failed', '₱15.00'), {
    title: 'Cash out did not go through',
    note: '₱15.00 is back in your wallet.',
  });
  assert.equal(cashOutResultText('processing', '₱15.00').title, 'Cash out is processing');
  assert.match(cashOutResultText('processing', '₱15.00').note, /back in your wallet if the transfer fails/);
});

test("a cash-out's notification gets no box while that cash-out's result page is on screen", () => {
  const page = {
    name: 'AppTransactionComplete',
    params: {
      referenceData: { transactionType: 'CASHOUT', amount: 15, transactionId: 'PRCO1' },
    },
  };
  // the notification's data values are text (FCM)
  assert.equal(resultOnScreen(page, { type: 'cash_out_paid', amount: '15.00' }), true);
  assert.equal(resultOnScreen(page, { type: 'cash_out_failed', amount: '15' }), true);
  // another amount: another cash-out, so its box still shows
  assert.equal(resultOnScreen(page, { type: 'cash_out_paid', amount: '700.00' }), false);
  // not a cash-out's notification, or not a cash-out's page
  assert.equal(resultOnScreen(page, { type: 'wallet_credited', amount: '15.00' }), false);
  assert.equal(resultOnScreen({ name: 'WalletScreen' }, { type: 'cash_out_paid', amount: '15.00' }), false);
  const topUp = {
    name: 'AppTransactionComplete',
    params: { referenceData: { transactionType: 'TOPUP', amount: 15 } },
  };
  assert.equal(resultOnScreen(topUp, { type: 'cash_out_paid', amount: '15.00' }), false);
  assert.equal(resultOnScreen(null, { type: 'cash_out_paid', amount: '15.00' }), false);
  assert.equal(resultOnScreen(page, null), false);
});

// CSO-19 (2026-11-25): a ₱20 cash-out's page, open more than 15 minutes, had
// stopped checking; its notification was swallowed all the same and the page
// kept "processing" until the app went to the background and back.
const MINUTE = 60 * 1000;
const resultPage = {
  name: 'AppTransactionComplete',
  params: {
    referenceData: { transactionType: 'CASHOUT', amount: 20, transactionId: 'PRCO19' },
  },
};
const paid = { type: 'cash_out_paid', amount: '20.00' };

// a result page as useCashOutResult registers it, opened `openFor` ms ago
function openPage(openFor, outcome = 'processing', reference = 'PRCO19') {
  const page = {
    reference,
    checks: 0,
    checkNow: () => {
      page.checks += 1;
    },
    saysIt: () => resultPageSaysIt(outcome, openFor),
  };
  page.close = watchResultPushes(page);
  return page;
}

test('a result page says its outcome while it checks, and once it has one; not after it stopped checking', () => {
  assert.equal(resultPageSaysIt('processing', 0), true);
  assert.equal(resultPageSaysIt('processing', 14 * MINUTE), true);
  assert.equal(resultPageSaysIt('processing', 15 * MINUTE), false);
  assert.equal(resultPageSaysIt('processing', 16 * MINUTE), false);
  assert.equal(resultPageSaysIt('completed', 16 * MINUTE), true);
  assert.equal(resultPageSaysIt('failed', 16 * MINUTE), true);
});

test("a cash-out's notification after its page stopped checking (16 min) shows its box, and the page checks at once", () => {
  const page = openPage(16 * MINUTE);
  try {
    assert.equal(cashOutPushOnPage(resultPage, paid), false);
    assert.equal(cashOutPushOnPage(resultPage, { type: 'cash_out_failed', amount: '20' }), false);
    assert.equal(page.checks, 2);
  } finally {
    page.close();
  }
});

test("a cash-out's notification while its page is still checking: no box, the page checks at once", () => {
  const page = openPage(2 * MINUTE);
  try {
    assert.equal(cashOutPushOnPage(resultPage, paid), true);
    assert.equal(page.checks, 1);
  } finally {
    page.close();
  }
});

test('a page that already says sent or failed takes the notification, however long it was open', () => {
  const page = openPage(40 * MINUTE, 'completed');
  try {
    assert.equal(cashOutPushOnPage(resultPage, paid), true);
  } finally {
    page.close();
  }
});

test("another page's notification, or none registered, keeps its box", () => {
  // the route matches but no page follows this cash-out (never registered,
  // or it closed): nothing on screen says it
  assert.equal(cashOutPushOnPage(resultPage, paid), false);
  const other = openPage(2 * MINUTE, 'processing', 'PRCO-OTHER');
  try {
    assert.equal(cashOutPushOnPage(resultPage, paid), false);
    assert.equal(other.checks, 0);
    // not that cash-out's amount, or not a cash-out notification
    const page = openPage(2 * MINUTE);
    try {
      assert.equal(cashOutPushOnPage(resultPage, { type: 'cash_out_paid', amount: '700' }), false);
      assert.equal(cashOutPushOnPage(resultPage, { type: 'wallet_credited', amount: '20' }), false);
      assert.equal(cashOutPushOnPage({ name: 'WalletScreen' }, paid), false);
      assert.equal(page.checks, 0);
    } finally {
      page.close();
    }
  } finally {
    other.close();
  }
});

test('the result page registers for the notification, and the push handler asks it rather than the route alone', () => {
  const app = new URL('../../../', import.meta.url);
  const hook = readFileSync(new URL('src/Hooks/useCashOutResult.js', app), 'utf8');
  assert.match(hook, /watchResultPushes\(/);
  assert.match(hook, /resultPageSaysIt\(/);
  // Passenger: PushNotificationManager.js; Rider: PushNotifications.native.js
  const handlers = [
    'src/Services/Push/PushNotificationManager.js',
    'src/Utils/PushNotifications.native.js',
  ]
    .map(path => new URL(path, app))
    .filter(existsSync)
    .map(url => readFileSync(url, 'utf8'))
    .filter(text => text.includes("from '@/Utils/cashOut'"));
  assert.equal(handlers.length, 1);
  assert.match(handlers[0], /cashOutPushOnPage\(/);
  assert.doesNotMatch(handlers[0], /resultOnScreen\(/);
});
