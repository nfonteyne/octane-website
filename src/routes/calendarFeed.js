// Public (unauthenticated) route: calendar apps subscribing to a webcal://
// link don't send our session cookie, so this can't sit behind requireAuth.
// The per-user token in the URL is the only access control — see
// usersRepo.ensureIcsToken / findByIcsToken.
const express = require('express');
const usersRepo = require('../repositories/usersRepo');
const rehearsalsRepo = require('../repositories/rehearsalsRepo');
const { buildRehearsalsFeed } = require('../lib/icsFeed');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get(
  '/rehearsals/:token.ics',
  asyncHandler(async (req, res) => {
    const user = await usersRepo.findByIcsToken(req.params.token);
    if (!user) return res.status(404).send('Not found');

    const rehearsals = await rehearsalsRepo.findUpcoming();
    res
      .type('text/calendar; charset=utf-8')
      .send(buildRehearsalsFeed(rehearsals));
  })
);

module.exports = router;
