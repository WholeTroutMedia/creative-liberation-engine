/**
 * @cle/config — V6 Configuration Management
 *
 * Environment-aware configuration loading with schema validation.
 * All configuration is centralized here — no service reads env vars directly.
 *
 * @capabilityId cap_config_system
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/** @typedef {'development' | 'staging' | 'production' | 'test'} Environment */

/**
 * Resolve the current environment from NODE_ENV.
 * @returns {Environment}
 */
export function resolveEnvironment() {
  const env = process.env.NODE_ENV || 'development';
  const valid = ['development', 'staging', 'production', 'test'];
  if (!valid.includes(env)) {
    throw new Error(`Invalid NODE_ENV: ${env}. Must be one of: ${valid.join(', ')}`);
  }
  return /** @type {Environment} */ (env);
}

/**
 * Load a configuration value with fallback chain:
 *   1. Environment variable
 *   2. .env file (already loaded by runtime)
 *   3. Default value
 *
 * @param {string} key - Environment variable name
 * @param {string} [defaultValue] - Fallback value
 * @returns {string}
 */
export function getConfig(key, defaultValue) {
  const value = process.env[key];
  if (value !== undefined && value !== '') return value;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Required config "${key}" is not set and has no default.`);
}

/**
 * Load a numeric configuration value.
 * @param {string} key
 * @param {number} [defaultValue]
 * @returns {number}
 */
export function getConfigInt(key, defaultValue) {
  const raw = process.env[key];
  if (raw !== undefined && raw !== '') {
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) throw new Error(`Config "${key}" must be an integer, got: ${raw}`);
    return parsed;
  }
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Required config "${key}" is not set and has no default.`);
}

/**
 * Load a boolean configuration value.
 * @param {string} key
 * @param {boolean} [defaultValue]
 * @returns {boolean}
 */
export function getConfigBool(key, defaultValue) {
  const raw = process.env[key];
  if (raw !== undefined && raw !== '') {
    return raw === 'true' || raw === '1' || raw === 'yes';
  }
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Required config "${key}" is not set and has no default.`);
}

/**
 * Build the standard V6 configuration object used by all services.
 * @returns {object}
 */
export function loadServiceConfig() {
  const env = resolveEnvironment();

  return {
    env,
    service: {
      name: getConfig('SERVICE_NAME', 'unknown'),
      port: getConfigInt('PORT', 3000),
      version: getConfig('SERVICE_VERSION', '6.0.0'),
    },
    postgres: {
      url: getConfig('POSTGRES_URL', ''),
    },
    redis: {
      url: getConfig('REDIS_URL', ''),
      password: getConfig('REDIS_PASSWORD', ''),
    },
    genkit: {
      url: getConfig('GENKIT_URL', 'http://localhost:4000'),
      apiKey: getConfig('GENKIT_API_KEY', ''),
      defaultModel: getConfig('GENKIT_DEFAULT_MODEL', 'googleai/gemini-2.5-flash'),
    },
    ollama: {
      host: getConfig('OLLAMA_HOST', 'http://localhost:11434'),
    },
    dispatch: {
      url: getConfig('DISPATCH_URL', 'http://localhost:5160'),
      project: getConfig('PROJECT', 'creative-liberation-engine'),
    },
    chroma: {
      url: getConfig('CHROMA_URL', 'http://localhost:8000'),
    },
    sovereignty: {
      nasHost: getConfig('NAS_HOST', '127.0.0.1'),
      nasPort: getConfigInt('NAS_SSH_PORT', 2000),
      sovereignMode: getConfigBool('SOVEREIGN_MODE', false),
    },
  };
}

export default { resolveEnvironment, getConfig, getConfigInt, getConfigBool, loadServiceConfig };
