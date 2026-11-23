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
// The smallest cash-out, for riders and passengers alike (the owner,
// 2026-11-23: "make our minimum cash out 15 for both passenger and driver");
// the backend refuses less (PayCools:MinimumCashOut, the same ₱15).
const MINIMUM_CASH_OUT = 15;

// Until the list comes from the backend (or when it cannot be had).
const GCASH = {
  code: 'GCASH',
  name: 'GCash',
  payMethod: 'EWALLET',
  isBank: false,
  logo: null,
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

// A channel's logo is a web address on the API (logo_url: the company's own
// icon, the owner 2026-11-23: "are we not including the logos of the payment
// method?"); anything else is no logo.
function logoOf(url) {
  const text = typeof url === 'string' ? url.trim() : '';
  return /^https?:\/\/\S+$/i.test(text) ? text : null;
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
      logo: logoOf(c.logo_url),
    }));
  return {
    ewallets: all.filter(c => !c.isBank),
    banks: all
      .filter(c => c.isBank)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// The chosen channel as the loaded list has it (with its logo), or as it was.
function freshChannel(channels, channel) {
  if (!channel) {
    return channel;
  }
  const all = [...(channels?.ewallets || []), ...(channels?.banks || [])];
  return all.find(c => c.code === channel.code) || channel;
}

// The letter on the tile of a channel without a logo.
function markLetter(name) {
  const first = String(name || '').match(/[A-Za-z0-9]/);
  return first ? first[0].toUpperCase() : '•';
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
// How long a cash-out waits for its answer: the API takes the money from
// the wallet, then waits up to 30 s for PayCools. Other requests give up after
// 15 s and call it a lost connection, which a cash-out that went through must
// never be told (overnight review 2026-11-23).
const CASH_OUT_TIMEOUT_MS = 90000;

const UNCONFIRMED =
  'No answer came back, so this cash out may have gone through. ' +
  "Check your wallet's balance and transactions before you try again.";

function afterCashOut(answer, amount) {
  if (!answer || answer.forceUpdate || answer.stale) {
    return {};
  }
  // no answer at all (the wait ran out, or the line dropped): the cash out
  // may have reached Pinoy Ride and PayCools all the same
  if (answer.offline) {
    return { refusal: UNCONFIRMED };
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
  CASH_OUT_TIMEOUT_MS,
  GCASH,
  MAX_NAME,
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
};
