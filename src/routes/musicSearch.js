const express = require('express');
const musicSearch = require('../lib/musicSearch');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    try {
      const candidates = await musicSearch.searchCandidates(q);
      res.json(candidates);
    } catch (err) {
      console.warn('[musicSearch] candidate search failed:', err.message);
      res.json([]);
    }
  })
);

router.get(
  '/links',
  asyncHandler(async (req, res) => {
    const title = (req.query.title || '').trim();
    const artist = (req.query.artist || '').trim();
    if (!title || !artist) return res.status(400).json({ error: 'title_and_artist_required' });
    const links = await musicSearch.findLinks(title, artist);
    res.json(links);
  })
);

module.exports = router;
