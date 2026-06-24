/**
 * V6 Boot Sequence
 *
 * Coordinates service initialization in the correct order:
 * 1. Load configuration
 * 2. Load registries
 * 3. Start health server
 * 4. Signal readiness
 */

import { loadServiceConfig } from '@cle/config';
import { loadRegistries } from './registry.mjs';
import { createHealthServer } from './health.mjs';

/**
 * Boot a V6 service with standardized initialization.
 *
 * @param {object} options
 * @param {string} options.serviceName - Name of the service
 * @param {() => Promise<void>} [options.onReady] - Callback after boot completes
 * @param {() => Promise<object>} [options.checkDependencies] - Health check dependency verifier
 * @returns {Promise<{ config: object, registries: object, healthServer: object }>}
 */
export async function boot({ serviceName, onReady, checkDependencies }) {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  Creative Liberation Engine V6 — ${serviceName.padEnd(14)}║`);
  console.log(`╚══════════════════════════════════════╝\n`);

  // Step 1: Configuration
  console.log(`[boot] Loading configuration...`);
  const config = loadServiceConfig();
  process.env.SERVICE_NAME = serviceName;
  console.log(`[boot] Environment: ${config.env}`);

  // Step 2: Registries
  console.log(`[boot] Loading registries...`);
  let registries;
  try {
    registries = loadRegistries();
  } catch (err) {
    console.warn(`[boot] Registry load skipped: ${err.message}`);
    registries = {};
  }

  // Step 3: Health server
  console.log(`[boot] Starting health server on :${config.service.port}...`);
  const healthServer = createHealthServer({
    serviceName,
    version: config.service.version,
    port: config.service.port,
    checkDependencies,
  });
  await healthServer.start();

  // Step 4: Ready signal
  console.log(`[boot] ✅ ${serviceName} is ready.\n`);

  if (onReady) {
    await onReady();
  }

  return { config, registries, healthServer };
}
