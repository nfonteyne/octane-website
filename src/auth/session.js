const session = require('express-session');
const pgSessionFactory = require('connect-pg-simple');
const pool = require('../db/pool');
const config = require('../config');

const PgSession = pgSessionFactory(session);

module.exports = session({
  store: new PgSession({
    pool,
    createTableIfMissing: true,
  }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    // Never mark the cookie Secure in dev-bypass mode: it's meant to be tested
    // over plain http://localhost, and browsers silently drop Secure cookies
    // on non-HTTPS origins, which would otherwise cause an endless redirect
    // back to /auth/login after a seemingly successful dev login.
    secure: config.nodeEnv === 'production' && !config.devBypassAuth,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  },
});
