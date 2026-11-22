// The registration form: what it checks before asking for a code, what it
// sends, and where a refusal from the backend is shown. Pure (no RN imports)
// so it runs under `node --test`.
//
// Register is a form: names, an optional email, the mobile number last, and
// the two consents. Everything that could stop the registration is checked
// before a code is sent (each code is a paid text message): here first, then
// by the backend, which checks the same and whether the number or the email
// is already taken. After the code the passenger is sent to log in.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The form's problems, by field: { firstName, lastName, email, mobile, consent }.
// Empty when it can be sent.
function registrationErrors({
  firstName,
  lastName,
  email,
  mobile,
  mobileValid,
  acceptedTerms,
  acceptedPrivacy,
}) {
  const errors = {};
  if (!String(firstName || '').trim()) {
    errors.firstName = 'First name is required';
  }
  if (!String(lastName || '').trim()) {
    errors.lastName = 'Last name is required';
  }
  const address = String(email || '').trim();
  if (address && !EMAIL.test(address)) {
    errors.email = 'Enter a valid email address, or leave it empty';
  }
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

// The form as the backend takes it (otp/register, then customers/register).
function registrationFields({ firstName, lastName, email }) {
  const address = String(email || '').trim();
  return {
    firstName: String(firstName || '').trim(),
    lastName: String(lastName || '').trim(),
    email: address || null,
  };
}

// Where the backend's refusal belongs on the form: { field, message }.
// field is one of the form's fields, or null for a message about the whole.
function refusalField(message) {
  const text = String(message || '');
  if (/email/i.test(text)) {
    return { field: 'email', message: text };
  }
  if (/mobile|number|rider/i.test(text)) {
    return { field: 'mobile', message: text };
  }
  if (/first name|last name/i.test(text)) {
    return { field: 'firstName', message: text };
  }
  return {
    field: null,
    message: text || 'Unable to send the code. Please try again.',
  };
}

// Where the code screen goes once the account is made: the login page, with
// the number filled in and the "registration successful" message.
function afterRegistering(mobileNumber) {
  return {
    index: 1,
    routes: [
      { name: 'LandingScreen' },
      {
        name: 'LoginScreen',
        params: { registrationComplete: true, mobileNumber },
      },
    ],
  };
}

module.exports = {
  registrationErrors,
  registrationFields,
  refusalField,
  afterRegistering,
};
