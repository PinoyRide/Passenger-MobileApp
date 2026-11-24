// The code boxes of the sign-in code screen (Components/OTP/OTPInput): the
// code is typed into ONE text field and the boxes only show it. Six fields,
// one per digit, needed `onKeyPress` to step back from an empty box, and
// Android sends `onKeyPress` only for the on-screen keyboard: a Backspace from
// a hardware keyboard (or adb's KEYCODE_DEL) cleared the last box and then did
// nothing (QA SIN-08). In one field every Backspace removes the last digit.
// Pure (no RN imports) so it runs under `node --test`. The same file in both
// apps (sharedUi.test.mjs).

// What the field holds, kept to its digits and to the code's length: a typed
// digit, a pasted "123 456", a code filled in by the phone.
const typedCode = (text, length) =>
  `${text ?? ''}`.replace(/\D/g, '').slice(0, length);

// What each box shows.
const boxesOf = (code, length) =>
  Array.from({ length }, (_, i) => code[i] || '');

// The box the next digit goes into (the last one once the code is whole).
const activeBox = (code, length) => Math.min(code.length, length - 1);

module.exports = { typedCode, boxesOf, activeBox };
