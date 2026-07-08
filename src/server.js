const config = require('./config');
const createApp = require('./app');
const { initOidc } = require('./auth/oidc');
const { runMigrations } = require('./db/migrate');

async function main() {
  await runMigrations();
  await initOidc();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Octane website listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
