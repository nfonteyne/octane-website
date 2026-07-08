const express = require('express');
const { client, getOidcConfig } = require('./oidc');
const usersRepo = require('../repositories/usersRepo');
const config = require('../config');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

router.get(
  '/login',
  asyncHandler(async (req, res) => {
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

    res.redirect(authUrl.href);
  })
);

router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const oidcConfig = getOidcConfig();
    const pending = req.session.oidc;
    if (!pending) {
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
      email: claims.email || null,
      isAdmin,
    });

    const returnTo = req.session.returnTo || '/';
    delete req.session.oidc;
    delete req.session.returnTo;

    req.session.regenerate((err) => {
      if (err) throw err;
      req.session.userId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) throw saveErr;
        res.redirect(returnTo);
      });
    });
  })
);

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
