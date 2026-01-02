import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Configuration options that can be specified in config file or CLI
 */
export interface Config {
  port?: number;
  host?: string;
  watch?: boolean;
  routes?: string;
  middlewares?: string;
  static?: string;
  readOnly?: boolean;
  noCors?: boolean;
  noGzip?: boolean;
  snapshots?: string;
  delay?: number;
  id?: string;
  foreignKeySuffix?: string;
  quiet?: boolean;
}

/**
 * Load configuration from a JSON file
 * 
 * @param configPath - Path to the configuration file
 * @returns Configuration object or null if file doesn't exist
 * @throws Error if file exists but is invalid JSON or contains invalid options
 * 
 * @example
 * ```typescript
 * const config = loadConfig('api-faker.json');
 * if (config) {
 *   console.log('Loaded config:', config);
 * }
 * ```
 */
export function loadConfig(configPath: string): Config | null {
  const resolvedPath = resolve(configPath);

  // If file doesn't exist, return null (not an error)
  if (!existsSync(resolvedPath)) {
    return null;
  }

  try {
    const content = readFileSync(resolvedPath, 'utf-8');
    const config = JSON.parse(content) as unknown;

    // Validate config is an object
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      throw new Error('Config file must contain a JSON object');
    }

    // Validate config properties
    validateConfig(config as Record<string, unknown>);

    return config as Config;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Config file must contain')) {
      throw error;
    }
    throw new Error(`Failed to load config from '${configPath}': ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate configuration object
 * 
 * @param config - Configuration object to validate
 * @throws Error if configuration contains invalid options
 */
function validateConfig(config: Record<string, unknown>): void {
  const validOptions = new Set([
    'port',
    'host',
    'watch',
    'routes',
    'middlewares',
    'static',
    'readOnly',
    'noCors',
    'noGzip',
    'snapshots',
    'delay',
    'id',
    'foreignKeySuffix',
    'quiet',
  ]);

  // Check for unknown options
  for (const key of Object.keys(config)) {
    if (!validOptions.has(key)) {
      throw new Error(`Unknown config option: '${key}'`);
    }
  }

  // Validate types
  if ('port' in config && (typeof config.port !== 'number' || config.port < 0 || config.port > 65535)) {
    throw new Error("Config option 'port' must be a number between 0 and 65535");
  }

  if ('host' in config && typeof config.host !== 'string') {
    throw new Error("Config option 'host' must be a string");
  }

  if ('watch' in config && typeof config.watch !== 'boolean') {
    throw new Error("Config option 'watch' must be a boolean");
  }

  if ('routes' in config && typeof config.routes !== 'string') {
    throw new Error("Config option 'routes' must be a string");
  }

  if ('middlewares' in config && typeof config.middlewares !== 'string') {
    throw new Error("Config option 'middlewares' must be a string");
  }

  if ('static' in config && typeof config.static !== 'string') {
    throw new Error("Config option 'static' must be a string");
  }

  if ('readOnly' in config && typeof config.readOnly !== 'boolean') {
    throw new Error("Config option 'readOnly' must be a boolean");
  }

  if ('noCors' in config && typeof config.noCors !== 'boolean') {
    throw new Error("Config option 'noCors' must be a boolean");
  }

  if ('noGzip' in config && typeof config.noGzip !== 'boolean') {
    throw new Error("Config option 'noGzip' must be a boolean");
  }

  if ('snapshots' in config && typeof config.snapshots !== 'string') {
    throw new Error("Config option 'snapshots' must be a string");
  }

  if ('delay' in config && (typeof config.delay !== 'number' || config.delay < 0)) {
    throw new Error("Config option 'delay' must be a non-negative number");
  }

  if ('id' in config && typeof config.id !== 'string') {
    throw new Error("Config option 'id' must be a string");
  }

  if ('foreignKeySuffix' in config && typeof config.foreignKeySuffix !== 'string') {
    throw new Error("Config option 'foreignKeySuffix' must be a string");
  }

  if ('quiet' in config && typeof config.quiet !== 'boolean') {
    throw new Error("Config option 'quiet' must be a boolean");
  }
}

/**
 * Merge CLI arguments with config file
 * CLI arguments take precedence over config file values
 * 
 * @param cliConfig - Configuration from CLI arguments
 * @param fileConfig - Configuration from config file
 * @returns Merged configuration
 * 
 * @example
 * ```typescript
 * const fileConfig = loadConfig('api-faker.json');
 * const merged = mergeConfig(cliArgs, fileConfig);
 * ```
 */
export function mergeConfig(cliConfig: Partial<Config>, fileConfig: Config | null): Config {
  if (!fileConfig) {
    return cliConfig as Config;
  }

  // CLI arguments override config file values
  return {
    ...fileConfig,
    ...cliConfig,
  };
}
