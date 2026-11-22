import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../registerForm.js';
const { registrationErrors, refusalField } = mod;

const complete = {
  mobile: '639171234567',
  mobileValid: true,
  acceptedTerms: true,
  acceptedPrivacy: true,
};

test('the number and both consents are all Register asks for', () => {
  assert.deepEqual(registrationErrors(complete), {});
});

test('a missing or unusable number is named before any code is sent', () => {
  assert.equal(
    registrationErrors({ ...complete, mobile: '' }).mobile,
    'Mobile number is required',
  );
  assert.equal(
    registrationErrors({ ...complete, mobileValid: false }).mobile,
    'Please enter a valid mobile number',
  );
});

test('both consents are needed', () => {
  for (const missing of ['acceptedTerms', 'acceptedPrivacy']) {
    assert.ok(registrationErrors({ ...complete, [missing]: false }).consent);
  }
});

test('a refusal about the number is shown under the number', () => {
  assert.deepEqual(
    refusalField('This mobile number is already registered. Please log in instead.'),
    {
      field: 'mobile',
      message:
        'This mobile number is already registered. Please log in instead.',
    },
  );
  assert.equal(
    refusalField(
      'This mobile number is currently logged in as a rider. Please log out from the rider account first.',
    ).field,
    'mobile',
  );
});

test('anything else is shown for the whole screen', () => {
  assert.deepEqual(refusalField('Please wait 40 seconds before requesting another OTP.'), {
    field: null,
    message: 'Please wait 40 seconds before requesting another OTP.',
  });
  assert.equal(refusalField('').message, 'Unable to send the code. Please try again.');
});
