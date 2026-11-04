// Helpers for the Update Required button. A logged-out passenger has no
// customer_id, so calling logout would always fail with a 400 and trap
// them on this screen. Skip it and go straight to the store.
const FALLBACK_ERROR =
  'Walang internet o may problema sa server. Subukan ulit.';

const shouldCallLogout = userInfo => !!userInfo?.id;

const logoutErrorText = error =>
  typeof error === 'string' && error.trim() ? error : FALLBACK_ERROR;

module.exports = { FALLBACK_ERROR, shouldCallLogout, logoutErrorText };
