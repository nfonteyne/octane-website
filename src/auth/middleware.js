const usersRepo = require('../repositories/usersRepo');

async function attachUser(req, res, next) {
  try {
    if (req.session.userId) {
      req.user = await usersRepo.findById(req.session.userId);
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'unauthenticated' });
    }
    return res.redirect(`/auth/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin };
