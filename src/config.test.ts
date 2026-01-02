import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, mergeConfig, Config } from './config';

describe('config', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `api-faker-config-test-${String(Date.now())}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    it('should return null if config file does not exist', () => {
      const configPath = join(testDir, 'nonexistent.json');
      const config = loadConfig(configPath);
      expect(config).toBeNull();
    });

    it('should load valid config file', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        port: 4000,
        host: '0.0.0.0',
        quiet: true
      }));

      const config = loadConfig(configPath);
      expect(config).toEqual({
        port: 4000,
        host: '0.0.0.0',
        quiet: true
      });
    });

    it('should load config with all valid options', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        port: 5000,
        host: 'localhost',
        watch: true,
        routes: './routes.json',
        middlewares: './middleware.js',
        static: './dist',
        readOnly: true,
        noCors: true,
        noGzip: true,
        snapshots: './snapshots',
        delay: 1000,
        id: '_id',
        foreignKeySuffix: '_id',
        quiet: true
      }));

      const config = loadConfig(configPath);
      expect(config).toEqual({
        port: 5000,
        host: 'localhost',
        watch: true,
        routes: './routes.json',
        middlewares: './middleware.js',
        static: './dist',
        readOnly: true,
        noCors: true,
        noGzip: true,
        snapshots: './snapshots',
        delay: 1000,
        id: '_id',
        foreignKeySuffix: '_id',
        quiet: true
      });
    });

    it('should throw error for invalid JSON', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, '{invalid json}');

      expect(() => loadConfig(configPath)).toThrow('Failed to load config');
    });

    it('should throw error for non-object JSON', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, '[]');

      expect(() => loadConfig(configPath)).toThrow('Config file must contain a JSON object');
    });

    it('should throw error for null JSON', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, 'null');

      expect(() => loadConfig(configPath)).toThrow('Config file must contain a JSON object');
    });

    it('should throw error for unknown config option', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        port: 3000,
        unknownOption: 'value'
      }));

      expect(() => loadConfig(configPath)).toThrow("Unknown config option: 'unknownOption'");
    });

    it('should throw error for invalid port type', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        port: 'invalid'
      }));

      expect(() => loadConfig(configPath)).toThrow("Config option 'port' must be a number");
    });

    it('should throw error for port out of range', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        port: 99999
      }));

      expect(() => loadConfig(configPath)).toThrow("Config option 'port' must be a number between 0 and 65535");
    });

    it('should throw error for invalid host type', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        host: 123
      }));

      expect(() => loadConfig(configPath)).toThrow("Config option 'host' must be a string");
    });

    it('should throw error for invalid watch type', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        watch: 'yes'
      }));

      expect(() => loadConfig(configPath)).toThrow("Config option 'watch' must be a boolean");
    });

    it('should throw error for invalid routes type', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        routes: 123
      }));

      expect(() => loadConfig(configPath)).toThrow("Config option 'routes' must be a string");
    });

    it('should throw error for invalid middlewares type', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        middlewares: ['array']
      }));

      expect(() => loadConfig(configPath)).toThrow("Config option 'middlewares' must be a string");
    });

    it('should throw error for invalid delay type', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        delay: -100
      }));

      expect(() => loadConfig(configPath)).toThrow("Config option 'delay' must be a non-negative number");
    });

    it('should throw error for invalid id type', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        id: 123
      }));

      expect(() => loadConfig(configPath)).toThrow("Config option 'id' must be a string");
    });

    it('should throw error for invalid foreignKeySuffix type', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        foreignKeySuffix: true
      }));

      expect(() => loadConfig(configPath)).toThrow("Config option 'foreignKeySuffix' must be a string");
    });

    it('should throw error for invalid readOnly type', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        readOnly: 'true'
      }));

      expect(() => loadConfig(configPath)).toThrow("Config option 'readOnly' must be a boolean");
    });

    it('should throw error for invalid quiet type', () => {
      const configPath = join(testDir, 'config.json');
      writeFileSync(configPath, JSON.stringify({
        quiet: 1
      }));

      expect(() => loadConfig(configPath)).toThrow("Config option 'quiet' must be a boolean");
    });
  });

  describe('mergeConfig', () => {
    it('should return CLI config when file config is null', () => {
      const cliConfig: Partial<Config> = {
        port: 4000,
        host: 'localhost'
      };

      const merged = mergeConfig(cliConfig, null);
      expect(merged).toEqual(cliConfig);
    });

    it('should use file config when CLI config is empty', () => {
      const fileConfig: Config = {
        port: 5000,
        host: '0.0.0.0',
        quiet: true
      };

      const merged = mergeConfig({}, fileConfig);
      expect(merged).toEqual(fileConfig);
    });

    it('should prioritize CLI config over file config', () => {
      const cliConfig: Partial<Config> = {
        port: 4000,
        host: 'localhost'
      };

      const fileConfig: Config = {
        port: 5000,
        host: '0.0.0.0',
        quiet: true
      };

      const merged = mergeConfig(cliConfig, fileConfig);
      expect(merged).toEqual({
        port: 4000,        // From CLI
        host: 'localhost', // From CLI
        quiet: true        // From file
      });
    });

    it('should merge all properties correctly', () => {
      const cliConfig: Partial<Config> = {
        port: 8080,
        watch: true
      };

      const fileConfig: Config = {
        port: 3000,
        host: 'localhost',
        routes: './routes.json',
        middlewares: './middleware.js',
        quiet: true
      };

      const merged = mergeConfig(cliConfig, fileConfig);
      expect(merged).toEqual({
        port: 8080,                      // From CLI (overrides file)
        watch: true,                     // From CLI
        host: 'localhost',               // From file
        routes: './routes.json',         // From file
        middlewares: './middleware.js',  // From file
        quiet: true                      // From file
      });
    });

    it('should handle boolean overrides correctly', () => {
      const cliConfig: Partial<Config> = {
        readOnly: true,
        noCors: true
      };

      const fileConfig: Config = {
        readOnly: false,
        noCors: false,
        noGzip: true
      };

      const merged = mergeConfig(cliConfig, fileConfig);
      expect(merged).toEqual({
        readOnly: true,  // From CLI
        noCors: true,    // From CLI
        noGzip: true     // From file
      });
    });
  });
});
