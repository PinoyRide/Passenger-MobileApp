// The other party's number on a completed trip's Booking Details
// (booking/get_contact/: the rider's for the passenger, the passenger's for
// the rider), for 24 hours after the trip. KI-63, the owner 2026-11-25: the
// API used to make a number up when masked calls (Twilio) were not set up,
// and tapping it could ring a stranger. It now answers `available` false
// instead, and the screen says so with nothing to tap. Pure (no RN imports)
// so it runs under `node --test`. The same file in both apps
// (sharedUi.test.mjs).

// What get_contact's answer means for the row:
//  - { number, dialUri }  a number to show and dial
//  - 'none'               the API says there is no number (`available` false)
//  - 'expired'            more than 24 hours after the trip
//  - 'unavailable'        no answer (no internet, the API down)
const contactFrom = (response, error) => {
  const payload = response && response.data;
  if (payload && payload.available === false) {
    return 'none';
  }
  if (payload && payload.proxy_contact_number) {
    const number = String(payload.proxy_contact_number);
    return {
      number,
      dialUri: payload.dial_uri || `tel:${number.replace(/\s+/g, '')}`,
    };
  }
  const message = String(
    error || (response && response.message) || '',
  ).toLowerCase();
  return message.includes('expired') ? 'expired' : 'unavailable';
};

// The row's words when there is no number. `who` is the other party:
// 'Rider' on the Passenger app, 'Passenger' on the Rider app.
const noContactText = who => `${who} contact number is not available`;

module.exports = { contactFrom, noContactText };
