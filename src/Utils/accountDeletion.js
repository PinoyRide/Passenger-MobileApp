// Deleting one's own account, as strictly as the Admin Portal (the owner,
// 2026-11-22). Pure (no RN imports) so it runs under `node --test`.
//
// The backend says first what stands in the way (a booking not finished, a
// wallet that is not at zero) and sends the confirming code only when
// nothing does. Deleting then needs that code and the word DELETE typed out.

const CONFIRM_WORD = 'DELETE';
const CODE_LENGTH = 6;

// Whether the delete button may be pressed: a whole code and DELETE typed out.
function canDelete({ code, confirm }) {
  return (
    new RegExp(`^\\d{${CODE_LENGTH}}$`).test(String(code || '').trim()) &&
    String(confirm || '').trim() === CONFIRM_WORD
  );
}

// The first screen of the flow, from the backend's check:
//   'blocked'  something stands in the way: show why, no code is sent
//   'choose'   nothing does: choose how to get the code
function stage(check) {
  return Array.isArray(check?.blockers) && check.blockers.length > 0
    ? 'blocked'
    : 'choose';
}

module.exports = { CONFIRM_WORD, CODE_LENGTH, canDelete, stage };
