require('dotenv').config();

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
  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),
  authentikIssuerUrl: required('AUTHENTIK_ISSUER_URL'),
  oidcClientId: required('OIDC_CLIENT_ID'),
  oidcClientSecret: required('OIDC_CLIENT_SECRET'),
  oidcRedirectUri: required('OIDC_REDIRECT_URI'),
  adminGroupName: process.env.ADMIN_GROUP_NAME || 'octane-admins',
};
