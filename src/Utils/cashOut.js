// Cash-out: what the Cash Out screen sends and what it does with the answer.
// Pure (no RN imports) so it runs under `node --test`.
//
// The backend sends the money through PayCools. It answers "processing" once
// PayCools has taken the order, "completed" when it is paid out, and an error
// when it was refused (the amount is then back in the wallet). Nothing here
// says "done" before the backend has said so.

// A GCash account is the mobile number it belongs to: 09XXXXXXXXX.
const GCASH_NUMBER = /^09\d{9}$/;

// PayCools takes at most 30 characters for the account name.
const MAX_NAME = 30;

function gcashNumber(text) {
  const digits = String(text || '').replace(/[^\d]/g, '');
  if (digits.length === 12 && digits.startsWith('639')) {
    return '0' + digits.slice(2);
  }
  return digits;
}

function gcashNumberError(text) {
  if (!String(text || '').trim()) {
    return 'Enter your GCash number';
  }
  return GCASH_NUMBER.test(gcashNumber(text))
    ? ''
    : 'Enter the 11-digit GCash number (09XXXXXXXXX)';
}

// The rider's name as the account name, within PayCools' limit.
function accountName(firstName, lastName) {
  const name = [firstName, lastName]
    .map(part => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');
  return name.length <= MAX_NAME ? name : name.slice(0, MAX_NAME).trim();
}

// The request body for cash_out/cash-out/.
function cashOutRequest({ amount, number, firstName, lastName }) {
  return {
    destination_bank_code: 'GCASH',
    pay_method: 'EWALLET',
    destination_acct_no: gcashNumber(number),
    destination_acct_name: accountName(firstName, lastName),
    amount: String(amount),
  };
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
  gcashNumber,
  gcashNumberError,
  accountName,
  cashOutRequest,
  afterCashOut,
};
