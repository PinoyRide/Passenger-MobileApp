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
  email: 'maria@example.com',
  mobile: '639171234567',
  mobileValid: true,
  acceptedTerms: true,
  acceptedPrivacy: true,
};

test('a complete form has nothing to fix', () => {
  assert.deepEqual(registrationErrors(complete), {});
});

test('every field is required, the email too', () => {
  assert.equal(registrationErrors({ ...complete, email: ' ' }).email, 'Email is required');
  assert.equal(
    registrationErrors({ ...complete, email: 'maria@' }).email,
    'Enter a valid email address',
  );
  assert.equal(registrationErrors({ ...complete, firstName: '' }).firstName, 'First name is required');
  assert.equal(registrationErrors({ ...complete, lastName: ' ' }).lastName, 'Last name is required');
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

test('what is sent: every field trimmed', () => {
  assert.deepEqual(
    registrationFields({ firstName: ' Maria ', lastName: ' Clara ', email: ' maria@example.com ' }),
    { firstName: 'Maria', lastName: 'Clara', email: 'maria@example.com' },
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
  assert.equal(refusalField('Email is required.').field, 'email');
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
