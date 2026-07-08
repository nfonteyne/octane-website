const express = require('express');
const { client, getOidcConfig } = require('./oidc');
const usersRepo = require('../repositories/usersRepo');
const config = require('../config');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function establishSession(req, res, user, returnTo, idToken) {
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.userId = user.id;
    // Kept only so /auth/logout can end the Authentik SSO session too
    // (id_token_hint) — without it, logging out locally still leaves an
    // active Authentik session that silently re-authenticates the user.
    if (idToken) req.session.idToken = idToken;
    req.session.save((saveErr) => {
      if (saveErr) throw saveErr;
      res.redirect(returnTo || '/');
    });
  });
}

// Dev-only login: no Authentik involved, lets you pick a name/admin flag
// to test the app locally. Only active when DEV_BYPASS_AUTH=true.
async function devLogin(req, res) {
  const { name, admin, returnTo } = req.query;

  if (!name) {
    res.set('Content-Type', 'text/html');
    return res.send(`<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>Connexion (mode dev)</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 400px; margin: 60px auto;">
  <h1>Connexion (mode dev)</h1>
  <p>Authentik n'est pas connecté (DEV_BYPASS_AUTH=true). Choisissez une identité de test.</p>
  <form method="get" action="/auth/login">
    <input type="hidden" name="returnTo" value="${escapeHtml(returnTo || '/')}">
    <p><label>Nom : <input name="name" required autofocus></label></p>
    <p><label><input type="checkbox" name="admin" value="1"> Compte admin</label></p>
    <button type="submit">Se connecter</button>
  </form>
</body>
</html>`);
  }

  const user = await usersRepo.upsertFromClaims({
    sub: `dev:${name}`,
    name,
    email: `${String(name).toLowerCase().replace(/\s+/g, '.')}@dev.local`,
    isAdmin: admin === '1' || admin === 'true',
  });

  establishSession(req, res, user, returnTo);
}

router.get(
  '/login',
  asyncHandler(async (req, res) => {
    if (config.devBypassAuth) {
      return devLogin(req, res);
    }

    const oidcConfig = getOidcConfig();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    const state = client.randomState();
    const nonce = client.randomNonce();

    req.session.oidc = { codeVerifier, state, nonce };
    if (req.query.returnTo) {
      req.session.returnTo = req.query.returnTo;
    }

    const authUrl = client.buildAuthorizationUrl(oidcConfig, {
      scope: 'openid profile email groups',
      redirect_uri: config.oidcRedirectUri,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    // Force the session write to complete (and surface any store error)
    // before sending the redirect, instead of relying on express-session's
    // implicit save-on-response-end behavior.
    req.session.save((err) => {
      if (err) throw err;
      res.redirect(authUrl.href);
    });
  })
);

router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    if (config.devBypassAuth) {
      return res.redirect('/auth/login');
    }

    const oidcConfig = getOidcConfig();
    const pending = req.session.oidc;
    if (!pending) {
      console.warn(
        '[auth] /auth/callback reached with no pending OIDC state.',
        'sessionID:', req.sessionID,
        'cookie header present:', Boolean(req.headers.cookie),
        'session keys:', Object.keys(req.session || {}),
      );
      return res.status(400).send('Session de connexion expirée, réessayez.');
    }

    const currentUrl = new URL(
      req.originalUrl,
      `${req.protocol}://${req.get('host')}`
    );

    const tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
      pkceCodeVerifier: pending.codeVerifier,
      expectedState: pending.state,
      expectedNonce: pending.nonce,
    });

    const claims = tokens.claims();
    const groups = Array.isArray(claims.groups) ? claims.groups : [];
    const isAdmin = groups.includes(config.adminGroupName);

    const user = await usersRepo.upsertFromClaims({
      sub: claims.sub,
      name: claims.name || claims.preferred_username || claims.email || claims.sub,
      username: claims.preferred_username || null,
      email: claims.email || null,
      avatarUrl: claims.picture || null,
      groups,
      isAdmin,
    });

    const returnTo = req.session.returnTo || '/';
    delete req.session.oidc;
    delete req.session.returnTo;

    establishSession(req, res, user, returnTo, tokens.id_token);
  })
);

router.get('/logout', (req, res) => {
  const idToken = req.session.idToken;

  req.session.destroy((err) => {
    if (err) throw err;

    // Local session is gone, but Authentik's own SSO session is still
    // active — redirecting straight to '/' would just have requireAuth
    // send the browser back through /auth/login, which Authentik would
    // silently re-approve (same user, no prompt). RP-initiated logout at
    // Authentik's end_session_endpoint is what actually signs them out.
    if (config.devBypassAuth || !idToken) {
      return res.redirect('/');
    }

    try {
      const oidcConfig = getOidcConfig();
      const endSessionUrl = client.buildEndSessionUrl(oidcConfig, {
        id_token_hint: idToken,
        post_logout_redirect_uri: config.postLogoutRedirectUri,
      });
      res.redirect(endSessionUrl.href);
    } catch (endSessionErr) {
      console.warn('[auth] could not build Authentik end-session URL, falling back to local logout only:', endSessionErr.message);
      res.redirect('/');
    }
  });
});

module.exports = router;
