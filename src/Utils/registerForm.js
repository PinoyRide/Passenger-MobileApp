// The Register screen: what it checks before asking for a code, and where a
// refusal from the backend is shown. Pure (no RN imports) so it runs under
// `node --test`.
//
// Register (the owner, 2026-11-22): the mobile number and the two consents
// first. A code proves the number and makes the account, signed in; the
// profile form (names, email, an optional photo) comes after and can be
// skipped for now. Everything that could stop the registration is checked
// before a code is sent (each code is a paid text message): the number here,
// then by the backend, which checks whether it is already taken.

// The screen's problems, by field: { mobile, consent }. Empty when it can be sent.
function registrationErrors({
  mobile,
  mobileValid,
  acceptedTerms,
  acceptedPrivacy,
}) {
  const errors = {};
  if (!mobile) {
    errors.mobile = 'Mobile number is required';
  } else if (!mobileValid) {
    errors.mobile = 'Please enter a valid mobile number';
  }
  if (!acceptedTerms || !acceptedPrivacy) {
    errors.consent =
      'Please accept the Terms and Conditions and the Privacy Policy';
  }
  return errors;
}

// Where the backend's refusal belongs on the screen: { field, message }.
// field is 'mobile' for anything about the number, or null for a message
// about the whole.
function refusalField(message) {
  const text = String(message || '');
  if (/mobile|number|rider/i.test(text)) {
    return { field: 'mobile', message: text };
  }
  return {
    field: null,
    message: text || 'Unable to send the code. Please try again.',
  };
}

module.exports = { registrationErrors, refusalField };
