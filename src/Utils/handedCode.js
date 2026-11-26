// A sign-in code handed to the app by the backend instead of being texted.
// Pure (no RN imports) so it runs under `node --test`.
//
// A test environment whose SMS account does not work can be set to answer
// an OTP request with the code itself (the backend's Otp:HandCodeToApp).
// The app then fills the code in for the person. Where texts go out, the
// answer carries no code and nothing here applies.

const CODE_LENGTH = 6;

// The code from the answer to an OTP request, or null when none was handed
// over (the usual case) or it is not a code this app can enter.
function handedCode(answer) {
  const code = answer?.code;
  if (code === null || code === undefined) {
    return null;
  }
  const digits = String(code);
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(digits) ? digits : null;
}

module.exports = { CODE_LENGTH, handedCode };
