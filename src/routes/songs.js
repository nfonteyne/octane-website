const express = require('express');
const songsRepo = require('../repositories/songsRepo');
const asyncHandler = require('../lib/asyncHandler');
const { isValidYoutubeUrl } = require('../lib/youtube');
const { isValidSpotifyUrl } = require('../lib/spotify');

const router = express.Router();

function validateLinks(youtubeUrl, spotifyUrl) {
  if (youtubeUrl && !isValidYoutubeUrl(youtubeUrl)) return 'invalid_youtube_url';
  if (spotifyUrl && !isValidSpotifyUrl(spotifyUrl)) return 'invalid_spotify_url';
  return null;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await songsRepo.findAll());
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const song = await songsRepo.findById(req.params.id);
    if (!song) return res.status(404).json({ error: 'not_found' });
    const tutorials = await songsRepo.findTutorials(req.params.id);
    res.json({ ...song, tutorials });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, artist, notes, youtubeUrl, spotifyUrl } = req.body || {};
    if (!title || !title.trim() || !artist || !artist.trim()) {
      return res.status(400).json({ error: 'title_and_artist_required' });
    }
    const linkError = validateLinks(youtubeUrl, spotifyUrl);
    if (linkError) return res.status(400).json({ error: linkError });
    const song = await songsRepo.create({
      title: title.trim(),
      artist: artist.trim(),
      notes,
      youtubeUrl: youtubeUrl ? youtubeUrl.trim() : null,
      spotifyUrl: spotifyUrl ? spotifyUrl.trim() : null,
      addedBy: req.user.id,
    });
    res.status(201).json(song);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { title, artist, notes, youtubeUrl, spotifyUrl } = req.body || {};
    if (!title || !title.trim() || !artist || !artist.trim()) {
      return res.status(400).json({ error: 'title_and_artist_required' });
    }
    const linkError = validateLinks(youtubeUrl, spotifyUrl);
    if (linkError) return res.status(400).json({ error: linkError });
    const song = await songsRepo.update(req.params.id, {
      title: title.trim(),
      artist: artist.trim(),
      notes,
      youtubeUrl: youtubeUrl ? youtubeUrl.trim() : null,
      spotifyUrl: spotifyUrl ? spotifyUrl.trim() : null,
    });
    if (!song) return res.status(404).json({ error: 'not_found' });
    res.json(song);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    try {
      await songsRepo.remove(req.params.id);
      res.status(204).end();
    } catch (err) {
      if (err.code === '23503') {
        return res
          .status(409)
          .json({ error: 'song_in_use', message: 'Ce morceau est utilisé dans une setlist et ne peut pas être supprimé.' });
      }
      throw err;
    }
  })
);

router.post(
  '/:id/tutorials',
  asyncHandler(async (req, res) => {
    const { instrumentId, url, label } = req.body || {};
    if (!instrumentId || !url || !url.trim()) {
      return res.status(400).json({ error: 'instrument_and_url_required' });
    }
    const song = await songsRepo.findById(req.params.id);
    if (!song) return res.status(404).json({ error: 'not_found' });
    const tutorial = await songsRepo.addTutorial(req.params.id, {
      instrumentId,
      url: url.trim(),
      label,
      addedBy: req.user.id,
    });
    res.status(201).json(tutorial);
  })
);

router.delete(
  '/:songId/tutorials/:id',
  asyncHandler(async (req, res) => {
    await songsRepo.removeTutorial(req.params.songId, req.params.id);
    res.status(204).end();
  })
);

module.exports = router;
