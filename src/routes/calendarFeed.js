// Public (unauthenticated) route: calendar apps subscribing to a webcal://
// link don't send our session cookie, so this can't sit behind requireAuth.
// The per-user token in the URL is the only access control — see
// usersRepo.ensureIcsToken / findByIcsToken.
const express = require('express');
const usersRepo = require('../repositories/usersRepo');
const rehearsalsRepo = require('../repositories/rehearsalsRepo');
const calendarRepo = require('../repositories/calendarRepo');
const { buildRehearsalsFeed } = require('../lib/icsFeed');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get(
  '/rehearsals/:token.ics',
  asyncHandler(async (req, res) => {
    const user = await usersRepo.findByIcsToken(req.params.token);
    if (!user) return res.status(404).send('Not found');

    const [rehearsals, settings, allUsers] = await Promise.all([
      rehearsalsRepo.findUpcoming(),
      calendarRepo.getSlotSettings(),
      usersRepo.findAllNames(),
    ]);
    // req.protocol honors X-Forwarded-Proto here — see app.set('trust proxy', 1) in app.js.
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res
      .type('text/calendar; charset=utf-8')
      .send(buildRehearsalsFeed(rehearsals, { threshold: settings.rehearsalConfirmThreshold, baseUrl, allUsers }));
  })
);

module.exports = router;
