/**
 * Health check server for V6 services.
 *
 * Every V6 service exposes /health as its liveness probe.
 * Conforms to route_*_health contracts in route manifests.
 */

import { createServer } from 'http';

/**
 * Create a lightweight health check HTTP server.
 *
 * @param {object} options
 * @param {string} options.serviceName - Name of the service
 * @param {string} options.version - Service version
 * @param {number} [options.port=3000] - Port to listen on
 * @param {() => Promise<object>} [options.checkDependencies] - Optional dependency checker
 * @returns {{ server: import('http').Server, start: () => Promise<void> }}
 */
export function createHealthServer({ serviceName, version, port = 3000, checkDependencies }) {
  const startedAt = new Date().toISOString();

  const server = createServer(async (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      try {
        const deps = checkDependencies ? await checkDependencies() : {};
        const response = {
          status: 'healthy',
          service: serviceName,
          version,
          uptime: process.uptime(),
          startedAt,
          timestamp: new Date().toISOString(),
          dependencies: deps,
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err) {
        const response = {
          status: 'unhealthy',
          service: serviceName,
          version,
          error: err.message,
          timestamp: new Date().toISOString(),
        };
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
    }
  });

  const start = () =>
    new Promise((resolve) => {
      server.listen(port, () => {
        console.log(`[${serviceName}] Health server listening on :${port}/health`);
        resolve();
      });
    });

  return { server, start };
}
