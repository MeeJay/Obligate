import './env';
import http from 'http';
import { createApp } from './app';
import { db } from './db';
import { config } from './config';
import { logger } from './utils/logger';
import { authService } from './services/auth.service';

async function main() {
  // 1. Run pending migrations
  logger.info('Running database migrations...');
  await db.migrate.latest();
  logger.info('Migrations complete');

  // 2. Ensure default admin user exists
  await authService.ensureDefaultAdmin(
    config.defaultAdminUsername,
    config.defaultAdminPassword,
  );

  // 3. Create Express app
  const app = createApp();
  const httpServer = http.createServer(app);

  // 4. Start listening
  httpServer.listen(config.port, () => {
    logger.info(`Obligate server running on port ${config.port}`);
  });
}

main().catch((err) => {
  logger.error(err, 'Failed to start Obligate server');
  process.exit(1);
});
