import express from 'express';

import type { AuthHttpDependencies } from './auth/http.js';
import { authenticationErrorHandler, createApiRouter } from './auth/http.js';

export type AppDependencies = AuthHttpDependencies;

export function createApp(dependencies: AppDependencies) {
  const app = express();

  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.set({
      'Cross-Origin-Opener-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    });
    next();
  });
  app.use((request, response, next) => {
    const origin = request.headers.origin;

    if (origin === dependencies.authConfig.webOrigin) {
      response.set({
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
      });
    }

    if (request.method === 'OPTIONS') {
      response.sendStatus(origin === dependencies.authConfig.webOrigin ? 204 : 403);
      return;
    }

    if (
      !['GET', 'HEAD'].includes(request.method) &&
      origin !== undefined &&
      origin !== dependencies.authConfig.webOrigin
    ) {
      response.status(403).json({
        error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed.' },
      });
      return;
    }

    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use('/api', createApiRouter(dependencies));
  app.use(authenticationErrorHandler);

  return app;
}
