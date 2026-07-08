require('dotenv').config();

const devBypassAuth = process.env.DEV_BYPASS_AUTH === 'true';

function required(name) {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV !== 'test') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  // Discrete connection fields rather than a single DATABASE_URL: a
  // password containing "/", "+", "=", "@" etc. (as produced by e.g.
  // `openssl rand -base64`) would otherwise need manual URL-encoding
  // to avoid breaking the connection string parser.
  pg: {
    host: process.env.PGHOST || 'postgres',
    port: parseInt(process.env.PGPORT, 10) || 5432,
    database: process.env.PGDATABASE || 'octane',
    user: process.env.PGUSER || 'octane',
    password: required('POSTGRES_PASSWORD'),
  },
  sessionSecret: required('SESSION_SECRET'),
  // DEV_BYPASS_AUTH lets you run the app locally without a real Authentik
  // instance: /auth/login prompts for a name instead of redirecting to OIDC.
  // Never enable this outside local development.
  devBypassAuth,
  authentikIssuerUrl: devBypassAuth ? process.env.AUTHENTIK_ISSUER_URL : required('AUTHENTIK_ISSUER_URL'),
  oidcClientId: devBypassAuth ? process.env.OIDC_CLIENT_ID : required('OIDC_CLIENT_ID'),
  oidcClientSecret: devBypassAuth ? process.env.OIDC_CLIENT_SECRET : required('OIDC_CLIENT_SECRET'),
  oidcRedirectUri: devBypassAuth ? process.env.OIDC_REDIRECT_URI : required('OIDC_REDIRECT_URI'),
  adminGroupName: process.env.ADMIN_GROUP_NAME || 'octane-admins',
};
