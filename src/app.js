const path = require('path');
const express = require('express');
const sessionMiddleware = require('./auth/session');
const authRoutes = require('./auth/routes');
const { attachUser, requireAuth } = require('./auth/middleware');
const apiRouter = require('./routes');
const calendarWebhooksRouter = require('./routes/calendarWebhooks');

function createApp() {
  const app = express();

  // Behind Traefik: without this, req.protocol/req.secure ignore
  // X-Forwarded-Proto and always report the plain-HTTP hop to the container.
  app.set('trust proxy', 1);

  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

  app.use(express.json());
  app.use(sessionMiddleware);
  app.use('/auth', authRoutes);
  app.use(attachUser);

  // Called by n8n directly (server-to-server, no session) — secret-protected
  // per-route inside the router itself, not gated by requireAuth. Must be
  // mounted before the /api requireAuth line so unmatched paths (e.g.
  // GET /api/calendar/people) fall through to the normal session-gated router.
  app.use('/api/calendar', calendarWebhooksRouter);

  app.use('/api', requireAuth, apiRouter);
  app.use(requireAuth, express.static(path.join(__dirname, '../public')));

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ error: 'internal_error' });
    }
    res.status(500).send('Une erreur est survenue.');
  });

  return app;
}

module.exports = createApp;
