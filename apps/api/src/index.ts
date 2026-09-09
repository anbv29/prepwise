import 'dotenv/config';

import {
  connectDatabase,
  createDatabaseRepositories,
  readDatabaseConfig,
} from '@prep-kit/database';
import {
  BraveDiscussionSearchProvider,
  createFullKitGenerator,
  OpenAiStructuredLlmProvider,
  readBraveSearchConfig,
  readOpenAiLlmConfig,
  readResearchConfig,
  safeFetchText,
} from '@prep-kit/pipeline';

import { createApp } from './app.js';
import { readAuthConfig } from './auth/config.js';
import { AuthService } from './auth/service.js';
import { readWorkerConfig } from './generation/config.js';
import { CachedResearchFetcher } from './generation/research-cache.js';
import { GenerationRequestService } from './generation/requests.js';
import { GenerationWorker } from './generation/worker.js';

const parsedPort = Number.parseInt(process.env.API_PORT ?? '4000', 10);
const port = Number.isNaN(parsedPort) ? 4000 : parsedPort;

async function startServer() {
  const databaseConnection = await connectDatabase(readDatabaseConfig());
  const repositories = createDatabaseRepositories(databaseConnection.database);
  const authConfig = readAuthConfig();
  const workerConfig = readWorkerConfig();
  const researchConfig = readResearchConfig();
  const llmProvider = new OpenAiStructuredLlmProvider(readOpenAiLlmConfig());
  const cachedResearch = new CachedResearchFetcher(
    repositories.researchCache,
    (url) => safeFetchText(url, researchConfig),
    researchConfig,
  );
  const hasDiscussionSearchKey = Boolean(
    process.env.BRAVE_SEARCH_API_KEY?.trim() || process.env.SEARCH_API_KEY?.trim(),
  );
  const generateKit = createFullKitGenerator({
    provider: llmProvider,
    researchConfig,
    fetchText: (url) => cachedResearch.fetch(url),
    ...(hasDiscussionSearchKey
      ? { discussionProvider: new BraveDiscussionSearchProvider(readBraveSearchConfig()) }
      : {}),
  });
  const authService = new AuthService(
    repositories.users,
    repositories.sessions,
    authConfig.sessionTtlMs,
  );
  const generationRequests = new GenerationRequestService(
    repositories.kits,
    repositories.generationJobs,
    workerConfig.maxAttempts,
  );
  const generationWorker = new GenerationWorker(repositories, generateKit, workerConfig);
  const app = createApp({ authConfig, authService, generationRequests, repositories });
  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
  generationWorker.start();
  let isShuttingDown = false;

  const shutdown = () => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    void Promise.all([
      generationWorker.stop(),
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    ])
      .then(() => databaseConnection.close())
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        console.error('API shutdown failed.', error);
        process.exit(1);
      });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

startServer().catch((error: unknown) => {
  console.error('API failed to start.', error);
  process.exitCode = 1;
});
