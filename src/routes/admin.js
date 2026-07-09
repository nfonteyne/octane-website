const express = require('express');
const usersRepo = require('../repositories/usersRepo');
const songsRepo = require('../repositories/songsRepo');
const suggestionsRepo = require('../repositories/suggestionsRepo');
const setlistsRepo = require('../repositories/setlistsRepo');
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

module.exports = router;
