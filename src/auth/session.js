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
    secure: config.nodeEnv === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 30,
  },
});
