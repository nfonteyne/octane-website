const express = require('express');
const usersRepo = require('../repositories/usersRepo');
const songsRepo = require('../repositories/songsRepo');
const suggestionsRepo = require('../repositories/suggestionsRepo');
const setlistsRepo = require('../repositories/setlistsRepo');
const discordWebhooksRepo = require('../repositories/discordWebhooksRepo');
const discord = require('../lib/discord');
const { requireAdmin } = require('../auth/middleware');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get(
  '/stats',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [users, songs, suggestions, concerts] = await Promise.all([
      usersRepo.findAllWithActivity(),
      songsRepo.getStats(),
      suggestionsRepo.getStats(),
      setlistsRepo.getStats(),
    ]);

    res.json({
      userCount: users.length,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatar_url,
        isAdmin: u.is_admin,
        createdAt: u.created_at,
        lastSeenAt: u.updated_at,
        songsAdded: u.songs_added,
        suggestionsProposed: u.suggestions_proposed,
        votesCast: u.votes_cast,
      })),
      songs: {
        totalSongs: songs.total_songs,
        distinctArtists: songs.distinct_artists,
        tutorialsAdded: songs.tutorials_added,
      },
      suggestions: {
        total: suggestions.total,
        pending: suggestions.pending,
        approved: suggestions.approved,
        rejected: suggestions.rejected,
        totalVotes: suggestions.total_votes,
      },
      concerts: {
        pastConcerts: concerts.past_concerts,
        upcomingConcerts: concerts.upcoming_concerts,
        avgSongsPerConcert: concerts.avg_songs_per_concert,
      },
    });
  })
);

router.get(
  '/discord-webhooks',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const webhooks = await discordWebhooksRepo.findAll();
    res.json(webhooks.map((w) => ({ id: w.id, label: w.label, url: w.url, createdAt: w.created_at })));
  })
);

router.post(
  '/discord-webhooks',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { label, url } = req.body || {};
    if (!url || !discord.isValidWebhookUrl(url.trim())) {
      return res.status(400).json({ error: 'invalid_webhook_url' });
    }
    const trimmedUrl = url.trim();
    try {
      const reachable = await discord.checkWebhookReachable(trimmedUrl);
      if (!reachable) return res.status(400).json({ error: 'webhook_unreachable' });
    } catch (err) {
      return res.status(400).json({ error: 'webhook_unreachable', message: err.message });
    }
    const webhook = await discordWebhooksRepo.create({ label: label ? label.trim() : null, url: trimmedUrl });
    res.status(201).json({ id: webhook.id, label: webhook.label, url: webhook.url, createdAt: webhook.created_at });
  })
);

router.delete(
  '/discord-webhooks/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await discordWebhooksRepo.remove(parseInt(req.params.id, 10));
    res.status(204).end();
  })
);

module.exports = router;
