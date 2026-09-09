import 'dotenv/config';

import {
  connectDatabase,
  createDatabaseRepositories,
  readDatabaseConfig,
} from '@prep-kit/database';

import { createApp } from './app.js';
import { readAuthConfig } from './auth/config.js';
import { AuthService } from './auth/service.js';

const parsedPort = Number.parseInt(process.env.API_PORT ?? '4000', 10);
const port = Number.isNaN(parsedPort) ? 4000 : parsedPort;

async function startServer() {
  const databaseConnection = await connectDatabase(readDatabaseConfig());
  const repositories = createDatabaseRepositories(databaseConnection.database);
  const authConfig = readAuthConfig();
  const authService = new AuthService(
    repositories.users,
    repositories.sessions,
    authConfig.sessionTtlMs,
  );
  const app = createApp({ authConfig, authService, repositories });
  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
  let isShuttingDown = false;

  const shutdown = () => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    server.close(() => {
      void databaseConnection.close().finally(() => process.exit(0));
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((error: unknown) => {
  console.error('API failed to start.', error);
  process.exitCode = 1;
});
