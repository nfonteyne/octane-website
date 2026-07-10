const express = require('express');
const usersRoutes = require('./users');
const instrumentsRoutes = require('./instruments');
const songsRoutes = require('./songs');
const suggestionsRoutes = require('./suggestions');
const setlistsRoutes = require('./setlists');
const musicSearchRoutes = require('./musicSearch');
const calendarRoutes = require('./calendar');
const adminRoutes = require('./admin');
const rehearsalsRoutes = require('./rehearsals');

const router = express.Router();

router.use('/users', usersRoutes);
router.use('/instruments', instrumentsRoutes);
router.use('/songs', songsRoutes);
router.use('/suggestions', suggestionsRoutes);
router.use('/setlists', setlistsRoutes);
router.use('/music-search', musicSearchRoutes);
router.use('/calendar', calendarRoutes);
router.use('/admin', adminRoutes);
router.use('/rehearsals', rehearsalsRoutes);

module.exports = router;
