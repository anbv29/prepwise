import 'dotenv/config';

import express, { type NextFunction, type Request, type Response } from 'express';

import { getApiRuntime } from './runtime.js';

const parsedPort = Number.parseInt(process.env.API_PORT ?? '4000', 10);
const port = Number.isNaN(parsedPort) ? 4000 : parsedPort;
const gateway = express();

gateway.use((request: Request, response: Response, next: NextFunction) => {
  void getApiRuntime()
    .then((runtime) => runtime.app(request, response, next))
    .catch(next);
});

gateway.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  void _next;
  console.error('API initialization failed.', error);
  response.status(503).json({
    error: {
      code: 'SERVICE_NOT_CONFIGURED',
      message: 'The API is not fully configured or its database is unavailable.',
    },
  });
});

export default gateway;

if (process.env.VERCEL !== '1') {
  const server = gateway.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
  let isShuttingDown = false;

  void getApiRuntime()
    .then((runtime) => runtime.worker.start())
    .catch((error: unknown) => {
      console.error('API failed to initialize.', error);
      process.exitCode = 1;
    });

  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    void getApiRuntime()
      .then(async (runtime) => {
        await runtime.worker.stop();
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
        await runtime.close();
      })
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        console.error('API shutdown failed.', error);
        process.exit(1);
      });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
