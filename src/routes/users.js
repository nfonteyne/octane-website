const express = require('express');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const { id, name, email, is_admin } = req.user;
    res.json({ id, name, email, isAdmin: is_admin });
  })
);

module.exports = router;
