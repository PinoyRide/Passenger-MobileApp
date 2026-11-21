import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../consent.js';
import policy from '../privacyPolicyContent.js';
const { POLICY_VERSION, needsConsent, consentBody, signedInRoutes } = mod;

const accepted = {
  id: 7,
  profile_complete: true,
  terms_accepted_at: '2026-11-21T03:00:00Z',
  privacy_accepted_at: '2026-11-21T03:00:00Z',
  privacy_version: POLICY_VERSION,
};

test('the version is the date the policy was last updated', () => {
  assert.equal(POLICY_VERSION, policy.updated);
  assert.ok(POLICY_VERSION.length > 0 && POLICY_VERSION.length <= 40); // fits the server column
});

test('nobody is asked when nobody is signed in', () => {
  assert.equal(needsConsent(null), false);
  assert.equal(needsConsent(undefined), false);
});

test('an account that never accepted is asked', () => {
  assert.equal(needsConsent({ id: 7 }), true);
  assert.equal(needsConsent({ ...accepted, terms_accepted_at: null }), true);
  assert.equal(needsConsent({ ...accepted, privacy_accepted_at: null }), true);
});

test('an account that accepted this version is not asked again', () => {
  assert.equal(needsConsent(accepted), false);
});

test('everyone is asked again when the policy changes', () => {
  assert.equal(
    needsConsent({ ...accepted, privacy_version: 'January 1, 2020' }),
    true,
  );
  assert.equal(needsConsent(accepted, 'A newer policy'), true);
});

test('the server is told what was ticked and which version was shown', () => {
  assert.deepEqual(
    consentBody({ acceptedTerms: true, acceptedPrivacy: true }),
    {
      acceptedTerms: true,
      acceptedPrivacy: true,
      privacyVersion: POLICY_VERSION,
    },
  );
  assert.equal(consentBody({ acceptedTerms: true }).acceptedPrivacy, false);
  assert.equal(consentBody().acceptedTerms, false);
});

test('after signing in: terms first, then the profile, then home', () => {
  assert.deepEqual(signedInRoutes({ id: 7, profile_complete: true }), {
    index: 0,
    routes: [{ name: 'GeneralTermsScreen', params: { mode: 'accept' } }],
  });
  assert.deepEqual(signedInRoutes({ ...accepted, profile_complete: false }), {
    index: 1,
    routes: [{ name: 'HomeScreen' }, { name: 'CompleteProfileScreen' }],
  });
  assert.deepEqual(signedInRoutes(accepted), {
    index: 0,
    routes: [{ name: 'HomeScreen' }],
  });
});
