import 'dotenv/config';

import { createApp } from './app.js';

const parsedPort = Number.parseInt(process.env.API_PORT ?? '4000', 10);
const port = Number.isNaN(parsedPort) ? 4000 : parsedPort;

const app = createApp();

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
