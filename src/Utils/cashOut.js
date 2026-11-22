// Cash-out: what the Cash out page sends and what it does with the answer.
// Pure (no RN imports) so it runs under `node --test`; the same file in both
// apps (sharedUi.test.mjs).
//
// The backend sends the money through PayCools, to any of PayCools' e-wallets
// (by the account's mobile number) or banks (by account number): the owner,
// 2026-11-23, "for cash out in passenger why is it gcash only? are we not
// using paycool?", then "same with rider". It answers "processing" once
// PayCools has taken the order, "completed" when it is paid out, and an error
// when it was refused (the amount is then back in the wallet). Nothing here
// says "done" before the backend has said so.

// An e-wallet account is the mobile number it belongs to: 09XXXXXXXXX.
const MOBILE = /^09\d{9}$/;
// PayCools takes at most 30 characters for the account name.
const MAX_NAME = 30;

// Until the list comes from the backend (or when it cannot be had).
const GCASH = {
  code: 'GCASH',
  name: 'GCash',
  payMethod: 'EWALLET',
  isBank: false,
};

const clean = text =>
  String(text || '')
    .trim()
    .replace(/\s+/g, ' ');

// A mobile number as an e-wallet reads it: 639171234567 or +63 917 123 4567
// become 09171234567.
function mobileNumber(text) {
  const digits = String(text || '').replace(/[^\d]/g, '');
  if (digits.length === 12 && digits.startsWith('639')) {
    return '0' + digits.slice(2);
  }
  return digits;
}

// A bank account number: its digits, without spaces or hyphens.
function bankAccountNumber(text) {
  return String(text || '').replace(/[\s-]/g, '');
}

// What is wrong with the account number for this channel, or ''.
function accountError(channel, text) {
  if (!String(text || '').trim()) {
    return channel?.isBank
      ? 'Enter the account number'
      : 'Enter the mobile number of the account';
  }
  if (channel?.isBank) {
    return /^\d{6,30}$/.test(bankAccountNumber(text))
      ? ''
      : 'Enter the account number in digits (6 to 30)';
  }
  return MOBILE.test(mobileNumber(text))
    ? ''
    : 'Enter the 11-digit mobile number (09XXXXXXXXX)';
}

// The person's name as the account name, within PayCools' limit.
function accountName(firstName, lastName) {
  const name = clean([firstName, lastName].filter(Boolean).join(' '));
  return name.length <= MAX_NAME ? name : name.slice(0, MAX_NAME).trim();
}

function accountNameError(name) {
  const value = clean(name);
  if (!value) {
    return 'Enter the name on the account';
  }
  return value.length > MAX_NAME ? `At most ${MAX_NAME} characters` : '';
}

// The channels to choose from, from cash_out/get-banks/: e-wallets in
// PayCools' order (GCash first), banks by name; none under maintenance.
function channelsFrom(list) {
  const all = (Array.isArray(list) ? list : [])
    .filter(c => c && c.code && !c.is_maintenance)
    .map(c => ({
      code: String(c.code),
      name: String(c.name || c.code),
      payMethod: c.pay_method || (c.is_bank ? 'BANK' : 'EWALLET'),
      isBank: Boolean(c.is_bank),
    }));
  return {
    ewallets: all.filter(c => !c.isBank),
    banks: all
      .filter(c => c.isBank)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// The request body for cash_out/cash-out/.
function cashOutRequest({ amount, channel, account, name }) {
  return {
    destination_bank_code: channel.code,
    pay_method: channel.payMethod,
    destination_acct_no: channel.isBank
      ? bankAccountNumber(account)
      : mobileNumber(account),
    destination_acct_name: clean(name).slice(0, MAX_NAME).trim(),
    amount: String(amount),
  };
}

// The account as the confirmation shows it: its last four digits.
function maskedAccount(channel, account) {
  const number = channel?.isBank
    ? bankAccountNumber(account)
    : mobileNumber(account);
  return number.length > 4 ? `•••• ${number.slice(-4)}` : number;
}

// The next step after asking for a cash-out. `answer` is what
// usePostRequest's makePostRequest resolved with.
//   { complete: { status, reference, amount } }  taken (processing) or paid (completed)
//   { refusal: message }                         not taken: say why, stay here
//   {}                                           nothing to do (another screen took over)
function afterCashOut(answer, amount) {
  if (!answer || answer.forceUpdate || answer.stale) {
    return {};
  }
  const data = answer.response?.data;
  if (answer.error || !data) {
    return {
      refusal:
        answer.error || 'Cash out could not be sent. Please try again later.',
    };
  }
  if (data.status !== 'processing' && data.status !== 'completed') {
    return {
      refusal:
        data.message || 'Cash out could not be sent. Please try again later.',
    };
  }
  return {
    complete: {
      status: data.status,
      reference: data.reference_id || data.referenceId || '',
      amount: data.amount ?? amount,
    },
  };
}

module.exports = {
  GCASH,
  MAX_NAME,
  mobileNumber,
  bankAccountNumber,
  accountError,
  accountName,
  accountNameError,
  channelsFrom,
  cashOutRequest,
  maskedAccount,
  afterCashOut,
};
