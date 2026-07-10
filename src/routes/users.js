const express = require('express');
const usersRepo = require('../repositories/usersRepo');
const config = require('../config');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

function authentikAccountUrl() {
  if (!config.authentikPublicUrl) return null;
  return new URL('/if/user/', config.authentikPublicUrl).href;
}

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const { id, name, display_name, username, email, avatar_url, is_admin } = req.user;
    res.json({
      id,
      name,
      hasCustomName: !!display_name,
      username,
      email,
      avatarUrl: avatar_url,
      isAdmin: is_admin,
      authentikAccountUrl: authentikAccountUrl(),
    });
  })
);

router.get(
  '/me/profile',
  asyncHandler(async (req, res) => {
    const { id, name, display_name, username, email, avatar_url, groups, is_admin, created_at } = req.user;
    const stats = await usersRepo.getActivityStats(id);
    res.json({
      id,
      name,
      hasCustomName: !!display_name,
      username,
      email,
      avatarUrl: avatar_url,
      groups,
      isAdmin: is_admin,
      createdAt: created_at,
      stats,
      authentikAccountUrl: authentikAccountUrl(),
    });
  })
);

router.patch(
  '/me/display-name',
  asyncHandler(async (req, res) => {
    const { displayName } = req.body || {};
    if (displayName && displayName.trim().length > 60) {
      return res.status(400).json({ error: 'display_name_too_long' });
    }
    const user = await usersRepo.updateDisplayName(req.user.id, displayName || '');
    res.json({ name: user.name, hasCustomName: !!user.display_name });
  })
);

module.exports = router;
