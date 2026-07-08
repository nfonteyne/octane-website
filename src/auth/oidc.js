const client = require('openid-client');
const config = require('../config');

let oidcConfig = null;

async function initOidc() {
  oidcConfig = await client.discovery(
    new URL(config.authentikIssuerUrl),
    config.oidcClientId,
    config.oidcClientSecret
  );
  return oidcConfig;
}

function getOidcConfig() {
  if (!oidcConfig) throw new Error('OIDC not initialized yet');
  return oidcConfig;
}

module.exports = { initOidc, getOidcConfig, client };
