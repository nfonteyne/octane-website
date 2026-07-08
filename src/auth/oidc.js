const client = require('openid-client');
const config = require('../config');

let oidcConfig = null;

async function initOidc() {
  const issuerUrl = new URL(config.authentikIssuerUrl);
  // Talking to Authentik over its internal Docker hostname (http://) rather
  // than its public HTTPS URL is expected (avoids a round trip through
  // Traefik) — openid-client refuses plain HTTP by default, so opt back in
  // for that case. The flag persists on the resulting Configuration for all
  // later calls (token exchange, etc.), not just discovery.
  const options = issuerUrl.protocol === 'http:' ? { execute: [client.allowInsecureRequests] } : undefined;
  oidcConfig = await client.discovery(
    issuerUrl,
    config.oidcClientId,
    config.oidcClientSecret,
    undefined,
    options
  );
  return oidcConfig;
}

function getOidcConfig() {
  if (!oidcConfig) throw new Error('OIDC not initialized yet');
  return oidcConfig;
}

module.exports = { initOidc, getOidcConfig, client };
