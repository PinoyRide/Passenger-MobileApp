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

module.exports = {
  SMS,
  EMAIL,
  offersEmail,
  maskedMobile,
  emailChoice,
  sentTo,
};
