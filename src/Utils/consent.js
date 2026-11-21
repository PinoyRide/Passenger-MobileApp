// Acceptance of the Terms and Conditions and the Privacy Policy.
// Pure (no RN imports) so it runs under `node --test`.
//
// A passenger has to tick both before using the app. The server keeps when
// they did, and which version of the policy they were shown. The version is
// the policy's "Last updated" date, so when the policy text changes everyone
// is asked to accept again.
const policy = require('./privacyPolicyContent');

const POLICY_VERSION = policy.updated;

// Whether a signed-in passenger still has to accept: they never did (an
// account older than this record), or the policy has changed since.
const needsConsent = (user, version = POLICY_VERSION) =>
  !!user &&
  (!user.terms_accepted_at ||
    !user.privacy_accepted_at ||
    user.privacy_version !== version);

// What the server is told: what was ticked, and the version that was shown.
const consentBody = ({ acceptedTerms, acceptedPrivacy } = {}) => ({
  acceptedTerms: !!acceptedTerms,
  acceptedPrivacy: !!acceptedPrivacy,
  privacyVersion: POLICY_VERSION,
});

// Where a passenger lands right after signing in, as a navigation state:
// the terms first when they still have to accept; then the profile (name and
// photo) when it is not complete, with Home underneath so Back still works.
const signedInRoutes = user => {
  if (needsConsent(user)) {
    return {
      index: 0,
      routes: [{ name: 'GeneralTermsScreen', params: { mode: 'accept' } }],
    };
  }
  if (!user.profile_complete) {
    return {
      index: 1,
      routes: [{ name: 'HomeScreen' }, { name: 'CompleteProfileScreen' }],
    };
  }
  return { index: 0, routes: [{ name: 'HomeScreen' }] };
};

module.exports = { POLICY_VERSION, needsConsent, consentBody, signedInRoutes };
