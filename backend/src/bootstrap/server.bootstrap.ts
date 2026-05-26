/**
 * Nexus V30 — HTTP Server Bootstrap
 */

import http from 'http';
import { Application } from 'express';

export async function startServer(app: Application): Promise<http.Server> {
  const PORT = parseInt(process.env.PORT ?? '3001', 10);
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}
