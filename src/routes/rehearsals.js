const express = require('express');
const rehearsalsRepo = require('../repositories/rehearsalsRepo');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rehearsals = await rehearsalsRepo.findUpcoming();
    res.json(
      rehearsals.map((r) => ({
        id: r.id,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        location: r.location,
        proposedBy: r.proposed_by,
        proposedByName: r.proposed_by_name,
      }))
    );
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { startsAt, endsAt, location } = req.body || {};
    if (!startsAt || !endsAt) {
      return res.status(400).json({ error: 'starts_at_and_ends_at_required' });
    }
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'invalid_date' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'ends_at_must_be_after_starts_at' });
    }
    if (start < new Date()) {
      return res.status(400).json({ error: 'starts_at_must_be_in_the_future' });
    }
    const rehearsal = await rehearsalsRepo.create({
      startsAt: start,
      endsAt: end,
      location: location ? location.trim() : null,
      proposedBy: req.user.id,
    });
    res.status(201).json({
      id: rehearsal.id,
      startsAt: rehearsal.starts_at,
      endsAt: rehearsal.ends_at,
      location: rehearsal.location,
      proposedBy: rehearsal.proposed_by,
    });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const rehearsal = await rehearsalsRepo.findById(req.params.id);
    if (!rehearsal) return res.status(404).json({ error: 'not_found' });
    if (rehearsal.proposed_by !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'forbidden' });
    }
    await rehearsalsRepo.remove(req.params.id);
    res.status(204).end();
  })
);

module.exports = router;
