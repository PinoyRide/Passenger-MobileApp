// Which payment a new booking starts on (the owner, 2026-11-23: "starting on
// pinoy ride wallet if there is enough balance"): the PinoyRide Wallet when
// its balance covers the fare, cash otherwise. Advance bookings are paid in
// cash. The passenger can still switch for a ride on the booking sheet, and
// the server checks the balance again when the ride is booked. A wallet
// locked until the ID check passes (`locked` in the wallet answer;
// Utils/walletLock.js, A-325) starts every ride on cash.
// Pure (no RN imports) so it runs under `node --test`.

// An amount from the API (a number or a string such as "275.00"); NaN when
// there is none.
const amountOf = value =>
  value === null || value === undefined || value === '' ? NaN : Number(value);

function startingPayment({ balance, fare, cashOnly = false, locked = false }) {
  const have = amountOf(balance);
  const need = amountOf(fare);
  if (
    cashOnly ||
    locked === true ||
    !Number.isFinite(have) ||
    !Number.isFinite(need)
  ) {
    return 'cash';
  }
  return need > 0 && have >= need ? 'wallet' : 'cash';
}

module.exports = { startingPayment };
