const config = require('./config');
const createApp = require('./app');
const { initOidc } = require('./auth/oidc');
const { runMigrations } = require('./db/migrate');

async function main() {
  await runMigrations();
  if (config.devBypassAuth) {
    console.warn('DEV_BYPASS_AUTH is enabled — Authentik/OIDC is skipped. Do not use this in production.');
  } else {
    await initOidc();
  }

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Octane website listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
