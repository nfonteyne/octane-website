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
    // req.path is relative to the mount prefix here (Express strips '/api'
    // for every layer registered via app.use('/api', ...)), so it never
    // actually starts with '/api/' — use req.originalUrl, which always holds
    // the full request path regardless of mount nesting.
    if (req.originalUrl.startsWith('/api/')) {
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
