import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../serverDown.js';

const { UPDATING_MESSAGE, looksLikeHtml, isServerDown, readable } = mod;

const RENDER_502 =
  '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>502</title>';

test("Render's error page is never shown as it came", () => {
  assert.equal(looksLikeHtml(RENDER_502), true);
  assert.equal(looksLikeHtml('  <html><body>Bad gateway</body></html>'), true);
  assert.equal(readable(RENDER_502), UPDATING_MESSAGE);
  assert.equal(readable('Booking not found'), 'Booking not found');
});

test('a gateway status without an answer of ours means the server is restarting', () => {
  assert.equal(isServerDown(502, RENDER_502), true);
  assert.equal(isServerDown(503, ''), true);
  assert.equal(isServerDown(504, undefined), true);
  assert.equal(isServerDown(200, RENDER_502), true);
});

test("our own refusals keep their message, a 503 included", () => {
  assert.equal(
    isServerDown(503, { status: 'error', code: 503, message: 'Cash-out is not available yet' }),
    false,
  );
  assert.equal(isServerDown(400, { message: 'Invalid number' }), false);
  assert.equal(isServerDown(500, 'Internal error'), false);
  assert.equal(isServerDown(undefined, undefined), false);
});
