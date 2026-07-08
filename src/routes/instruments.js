const express = require('express');
const instrumentsRepo = require('../repositories/instrumentsRepo');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const instruments = await instrumentsRepo.findAll();
    res.json(instruments);
  })
);

module.exports = router;
