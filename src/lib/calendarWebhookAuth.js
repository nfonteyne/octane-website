const crypto = require('crypto');
const config = require('../config');

// Protects the two endpoints n8n calls directly (server-to-server, no
// browser session available) — a shared secret header instead of the
// session-based auth the rest of /api uses. Constant-time compare since
// this is a bearer-secret check.
function calendarWebhookAuth(req, res, next) {
  const provided = req.header('X-Calendar-Webhook-Secret') || '';
  const expected = config.calendarWebhookSecret;

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  const valid =
    providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!valid) {
    return res.status(401).json({ error: 'invalid_webhook_secret' });
  }
  next();
}

module.exports = calendarWebhookAuth;
