const express = require('express');
const usersRoutes = require('./users');
const instrumentsRoutes = require('./instruments');
const songsRoutes = require('./songs');
const suggestionsRoutes = require('./suggestions');
const setlistsRoutes = require('./setlists');

const router = express.Router();

router.use('/users', usersRoutes);
router.use('/instruments', instrumentsRoutes);
router.use('/songs', songsRoutes);
router.use('/suggestions', suggestionsRoutes);
router.use('/setlists', setlistsRoutes);

module.exports = router;
