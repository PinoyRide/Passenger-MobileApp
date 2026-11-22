import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../registerForm.js';
const {
  registrationErrors,
  registrationFields,
  refusalField,
  afterRegistering,
} = mod;

const complete = {
  firstName: 'Maria',
  lastName: 'Clara',
  email: '',
  mobile: '639171234567',
  mobileValid: true,
  acceptedTerms: true,
  acceptedPrivacy: true,
};

test('a complete form has nothing to fix; the email is optional', () => {
  assert.deepEqual(registrationErrors(complete), {});
  assert.deepEqual(
    registrationErrors({ ...complete, email: 'maria@example.com' }),
    {},
  );
});

test('every missing piece is named before any code is sent', () => {
  const errors = registrationErrors({
    firstName: ' ',
    lastName: '',
    email: 'not an email',
    mobile: '',
    mobileValid: false,
    acceptedTerms: true,
    acceptedPrivacy: false,
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    'consent',
    'email',
    'firstName',
    'lastName',
    'mobile',
  ]);
  assert.match(
    registrationErrors({ ...complete, mobileValid: false }).mobile,
    /valid mobile/,
  );
});

test('what is sent: trimmed names, and no email when none was given', () => {
  assert.deepEqual(
    registrationFields({ firstName: ' Maria ', lastName: ' Clara ', email: ' ' }),
    { firstName: 'Maria', lastName: 'Clara', email: null },
  );
  assert.equal(
    registrationFields({ ...complete, email: ' m@x.ph ' }).email,
    'm@x.ph',
  );
});

test("the backend's refusals land under the field they are about", () => {
  assert.equal(refusalField('This email address already exists.').field, 'email');
  assert.equal(
    refusalField('This mobile number is already registered. Please log in instead.').field,
    'mobile',
  );
  assert.equal(
    refusalField('This number is signed in on the Pinoy Ride Driver app.').field,
    'mobile',
  );
  assert.equal(refusalField('First name and last name are required.').field, 'firstName');
  assert.deepEqual(refusalField(''), {
    field: null,
    message: 'Unable to send the code. Please try again.',
  });
});

test('after the code: the login page, the number filled in, with Landing underneath', () => {
  assert.deepEqual(afterRegistering('639171234567'), {
    index: 1,
    routes: [
      { name: 'LandingScreen' },
      {
        name: 'LoginScreen',
        params: { registrationComplete: true, mobileNumber: '639171234567' },
      },
    ],
  });
});
