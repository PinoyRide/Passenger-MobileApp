// How people reach Pinoy Ride support, the one place both apps take it from
// (Q-WALLET-TEXT; the owner, A-217, 2026-11-26: the team picks the contact
// shown, the support email placeholder while there is no official one).
// Settings > Help & support shows it in both apps, and the Passenger's
// "Contact support" on the rating page. The phone number the rating page used
// to dial was never confirmed as a support line.
//
// SUPPORT_EMAIL is the public support address the owner set (A-285 item 9,
// the same one as the Google Play contact and the privacy policy): the box
// shows it with a "Write an email" button. Were it ever emptied or not an
// address, the box falls back to the placeholder and offers nothing to tap.
// Pure (no RN imports) so it runs under `node --test`. The same file in both
// apps (sharedUi.test.mjs).

const SUPPORT_EMAIL = 'contact.pinoyride@gmail.com';

const SUPPORT_EMAIL_PLACEHOLDER = '[support email to be announced]';

const HELP_TITLE = 'Help & support';

// the Help Desk Pack's first line on every channel: 911 before anything else
const EMERGENCY_LINE = 'If someone is in danger or hurt, call 911 now.';

// A usable address, or '' (not set yet, or not an address).
const supportEmail = (email = SUPPORT_EMAIL) => {
  const address = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : '';
};

const supportMailUri = address =>
  `mailto:${address}?subject=${encodeURIComponent('Pinoy Ride support')}`;

// appAlert's arguments (title, message, buttons) for the Help & support box.
// `open` opens a link (Linking.openURL); on a phone with no mail app nothing
// happens and nothing is thrown: the address was in the box they just read.
// Not set yet: a notice (one OK), which closes itself once read.
const supportAlert = (open, email = SUPPORT_EMAIL) => {
  const address = supportEmail(email);
  if (!address) {
    return [
      HELP_TITLE,
      `Email us at ${SUPPORT_EMAIL_PLACEHOLDER}.\n\n${EMERGENCY_LINE}`,
    ];
  }
  return [
    HELP_TITLE,
    `Email us at ${address}.\n\n${EMERGENCY_LINE}`,
    [
      { text: 'Close', style: 'cancel' },
      {
        text: 'Write an email',
        onPress: () => {
          try {
            Promise.resolve(open(supportMailUri(address))).catch(() => {});
          } catch (e) {
            // no mail app
          }
        },
      },
    ],
  ];
};

module.exports = {
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_PLACEHOLDER,
  EMERGENCY_LINE,
  supportEmail,
  supportMailUri,
  supportAlert,
};
