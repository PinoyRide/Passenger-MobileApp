// A peso amount as the booking screens show it: "₱128.00". Pure (no RN
// imports) so it runs under `node --test`. Moved here from
// BookingStatusModal.js, unchanged, so the booking sheet uses the same one.

function formatPeso(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) {
    return '₱0.00';
  }
  return `₱${n.toFixed(2)}`;
}

module.exports = { formatPeso };
