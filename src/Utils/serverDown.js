// When the API cannot answer for a moment: while it restarts for an update,
// Render answers with its own error page (HTML), or with a gateway status
// and no answer of ours. Never shown as it came (the owner, 2026-11-23: the
// Passenger app showed Render's 502 page, HTML and all, during a deploy).
// The same file in both apps (sharedUi.test.mjs). Pure (no RN imports) so it
// runs under `node --test`.

const UPDATING_MESSAGE =
  'Pinoy Ride is updating. Please try again in a moment.';

const GATEWAY = [502, 503, 504];

// An HTML page rather than a message.
function looksLikeHtml(text) {
  return (
    typeof text === 'string' && /^\s*<(!doctype|html|head|body)\b/i.test(text)
  );
}

// The server, not the request, is the problem: Render's page, or a gateway
// status without an answer of ours. Our own 503s ("Cash-out is not available
// yet") carry their message and stay as they are.
function isServerDown(status, body) {
  if (looksLikeHtml(body)) {
    return true;
  }
  const ours = body != null && typeof body === 'object';
  return !ours && GATEWAY.includes(Number(status));
}

// A message fit to show: an HTML page becomes the updating message.
function readable(text) {
  return looksLikeHtml(text) ? UPDATING_MESSAGE : text;
}

module.exports = { UPDATING_MESSAGE, looksLikeHtml, isServerDown, readable };
