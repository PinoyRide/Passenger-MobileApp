// How a sign-in code reaches the person. Pure (no RN imports) so it runs
// under `node --test`.
//
// The owner, 2026-11-22: "if the account have email to it, they can choose
// where to send the OTP either sms or via email". Before sending anything the
// backend says which ways an account has (otp/login/options: channels and
// emailHint), after every check the sign-in makes. A registration code is
// always texted: the account has no email yet.

const SMS = 'sms';
const EMAIL = 'email';

// Whether the account can be emailed its code.
const offersEmail = options =>
  Array.isArray(options?.channels) && options.channels.includes(EMAIL);

// The line under "Enter One-Time PIN": where the code went.
function sentTo({ channel, emailHint, mobileNumber, handed }) {
  if (handed) {
    return 'Test environment: no text message is sent. The PIN is filled in for you.';
  }
  if (channel === EMAIL) {
    return `A One-Time PIN was sent to ${emailHint || 'your email address'}`;
  }
  return `A One-Time PIN was sent to +63 ******${String(
    mobileNumber || '',
  ).slice(-4)}`;
}

module.exports = { SMS, EMAIL, offersEmail, sentTo };
