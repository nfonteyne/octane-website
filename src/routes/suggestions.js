const express = require('express');
const suggestionsRepo = require('../repositories/suggestionsRepo');
const { requireAdmin } = require('../auth/middleware');
const { isValidYoutubeUrl } = require('../lib/youtube');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await suggestionsRepo.findAll());
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const suggestion = await suggestionsRepo.findById(req.params.id);
    if (!suggestion) return res.status(404).json({ error: 'not_found' });
    const votes = await suggestionsRepo.findVotes(req.params.id);
    res.json({ ...suggestion, votes });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, artist, youtubeUrl } = req.body || {};
    if (!title || !title.trim() || !youtubeUrl || !youtubeUrl.trim()) {
      return res.status(400).json({ error: 'title_and_youtube_url_required' });
    }
    if (!isValidYoutubeUrl(youtubeUrl.trim())) {
      return res.status(400).json({ error: 'invalid_youtube_url' });
    }
    const suggestion = await suggestionsRepo.create({
      title: title.trim(),
      artist: artist ? artist.trim() : null,
      youtubeUrl: youtubeUrl.trim(),
      suggestedBy: req.user.id,
    });
    res.status(201).json(suggestion);
  })
);

router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'invalid_status' });
    }
    const suggestion = await suggestionsRepo.updateStatus(req.params.id, status);
    if (!suggestion) return res.status(404).json({ error: 'not_found' });
    res.json(suggestion);
  })
);

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await suggestionsRepo.remove(req.params.id);
    res.status(204).end();
  })
);

router.post(
  '/:id/vote',
  asyncHandler(async (req, res) => {
    const { vote, comment } = req.body || {};
    if (!['approve', 'reject'].includes(vote)) {
      return res.status(400).json({ error: 'invalid_vote' });
    }
    const suggestion = await suggestionsRepo.findById(req.params.id);
    if (!suggestion) return res.status(404).json({ error: 'not_found' });
    const result = await suggestionsRepo.upsertVote(req.params.id, req.user.id, { vote, comment });
    res.status(200).json(result);
  })
);

router.delete(
  '/:id/vote',
  asyncHandler(async (req, res) => {
    await suggestionsRepo.removeVote(req.params.id, req.user.id);
    res.status(204).end();
  })
);

router.post(
  '/:id/promote',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const song = await suggestionsRepo.promoteToSong(req.params.id, req.user.id);
    if (!song) return res.status(404).json({ error: 'not_found' });
    res.status(201).json(song);
  })
);

module.exports = router;
