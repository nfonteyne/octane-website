const express = require('express');
const setlistsRepo = require('../repositories/setlistsRepo');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

async function withSongs(setlist) {
  if (!setlist) return null;
  const songs = await setlistsRepo.findSongs(setlist.id);
  return { ...setlist, songs };
}

router.get(
  '/next',
  asyncHandler(async (req, res) => {
    const setlist = await setlistsRepo.findNext();
    res.json(await withSongs(setlist));
  })
);

router.get(
  '/history',
  asyncHandler(async (req, res) => {
    if (req.query.full) {
      return res.json(await setlistsRepo.findHistoryWithSongs());
    }
    res.json(await setlistsRepo.findHistory());
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const setlist = await setlistsRepo.findById(req.params.id);
    if (!setlist) return res.status(404).json({ error: 'not_found' });
    res.json(await withSongs(setlist));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, venue, concertDate } = req.body || {};
    if (!concertDate) return res.status(400).json({ error: 'concert_date_required' });
    const setlist = await setlistsRepo.create({ name, venue, concertDate, createdBy: req.user.id });
    res.status(201).json(setlist);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { name, venue, concertDate } = req.body || {};
    if (!concertDate) return res.status(400).json({ error: 'concert_date_required' });
    const setlist = await setlistsRepo.update(req.params.id, { name, venue, concertDate });
    if (!setlist) return res.status(404).json({ error: 'not_found' });
    res.json(setlist);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await setlistsRepo.remove(req.params.id);
    res.status(204).end();
  })
);

router.put(
  '/:id/songs',
  asyncHandler(async (req, res) => {
    const { songs } = req.body || {};
    if (!Array.isArray(songs)) return res.status(400).json({ error: 'songs_array_required' });
    for (const s of songs) {
      if (!s.songId || typeof s.position !== 'number') {
        return res.status(400).json({ error: 'invalid_song_entry' });
      }
    }
    try {
      await setlistsRepo.replaceSongs(req.params.id, songs);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'duplicate_position', message: 'Deux morceaux ont la même position.' });
      }
      throw err;
    }
    const setlist = await setlistsRepo.findById(req.params.id);
    res.json(await withSongs(setlist));
  })
);

router.post(
  '/:id/songs',
  asyncHandler(async (req, res) => {
    const { songId, position, note, isEncore } = req.body || {};
    if (!songId || typeof position !== 'number') {
      return res.status(400).json({ error: 'invalid_song_entry' });
    }
    try {
      const entry = await setlistsRepo.addSong(req.params.id, { songId, position, note, isEncore });
      res.status(201).json(entry);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'duplicate_position', message: 'Ce morceau ou cette position est déjà utilisé.' });
      }
      throw err;
    }
  })
);

router.delete(
  '/:id/songs/:setlistSongId',
  asyncHandler(async (req, res) => {
    await setlistsRepo.removeSong(req.params.id, req.params.setlistSongId);
    res.status(204).end();
  })
);

module.exports = router;
