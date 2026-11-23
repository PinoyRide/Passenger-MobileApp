// How a sign-in code reaches the person. Pure (no RN imports) so it runs under
// `node --test`. The same file in both apps.
//
// The owner, 2026-11-22: "if the account have email to it, they can choose
// where to send the OTP either sms or via email", then "the passenger choosing
// where to send should be the same as the rider". Before sending anything the
// backend says which ways an account has (otp/login/options in the Passenger
// app, otp/login-options/ in the Rider app: channels and the email hint),
// after every check the sign-in makes. The choice is then a step of its own
// (CodeChannelScreen). A registration code is always texted: the account has
// no email yet.

const SMS = 'sms';
const EMAIL = 'email';

// Whether the account can be emailed its code.
const offersEmail = options =>
  Array.isArray(options?.channels) && options.channels.includes(EMAIL);

// "+63 ••• ••• 4567": the number's end only, the way the email hint shows an
// address ("j•••@gmail.com").
const maskedMobile = mobile =>
  `+63 ••• ••• ${String(mobile || '')
    .replace(/\D/g, '')
    .slice(-4)}`;

// The email choice: offered with the address mostly hidden, or shown greyed
// out when the account has no email.
function emailChoice(options) {
  return offersEmail(options)
    ? { available: true, detail: options.emailHint || 'Your email address' }
    : { available: false, detail: 'No email on this account' };
}

// The line under "Enter One-Time PIN": where the code went.
function sentTo({ channel, emailHint, mobileNumber, handed }) {
  if (handed) {
    return 'Test environment: no text message is sent. The PIN is filled in for you.';
  }
  if (channel === EMAIL) {
    return `A One-Time PIN was sent to ${emailHint || 'your email address'}`;
  }
  return `A One-Time PIN was sent to ${maskedMobile(mobileNumber)}`;
}

// What the code screen says when the code typed is refused (QA PR-APP-14: "a
// clear error message (e.g. "Code has expired")" and the way to a new code).
// The server's words for a code are "OTP expired", "Invalid OTP" and "Too many
// wrong codes. Please request a new OTP."; any other refusal (a number signed
// in elsewhere, a deactivated account) is shown as the server words it.
const NEW_CODE = 'Tap "Request a new OTP" below to get a new one.';
function codeRefused(error) {
  const text = String(error || '');
  if (/\bOTP expired\b/i.test(text)) {
    return {
      title: 'Code has expired',
      message: `This One-Time PIN is no longer valid. ${NEW_CODE}`,
    };
  }
  if (/too many wrong codes/i.test(text)) {
    return {
      title: 'Code no longer valid',
      message: `Too many wrong codes were entered. ${NEW_CODE}`,
    };
  }
  if (/\binvalid otp\b/i.test(text)) {
    return {
      title: 'Wrong code',
      message: 'That One-Time PIN is not right. Please check it and try again.',
    };
  }
  return {
    title: 'Error',
    message: text || 'Something went wrong. Please try again.',
  };
}

module.exports = {
  SMS,
  EMAIL,
  offersEmail,
  maskedMobile,
  emailChoice,
  sentTo,
  codeRefused,
};
