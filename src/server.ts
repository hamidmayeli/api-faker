import express, { Express } from 'express';
import cors from 'cors';
import compression from 'compression';
import { Database } from './database';
import { createRouter, RouterOptions } from './router';

/**
 * Server configuration options
 */
export interface ServerOptions extends RouterOptions {
  port?: number;
  host?: string;
  noCors?: boolean;
  noGzip?: boolean;
  delay?: number;
  quiet?: boolean;
}

/**
 * Create Express server with API Faker
 * 
 * @param db - Database instance
 * @param options - Server configuration options
 * @returns Express application
 * 
 * @example
 * ```typescript
 * const db = new Database('db.json');
 * await db.init();
 * const app = createServer(db, { port: 3000 });
 * ```
 */
export function createServer(db: Database, options: Partial<ServerOptions> = {}): Express {
  const app = express();

  // CORS
  if (!options.noCors) {
    app.use(cors());
  }

  // GZIP compression
  if (!options.noGzip) {
    app.use(compression());
  }

  // JSON body parser
  app.use(express.json());

  // Delay middleware (for testing/simulation)
  if (options.delay && options.delay > 0) {
    const delay = options.delay;
    app.use((_req, _res, next) => {
      setTimeout(() => {
        next();
      }, delay);
    });
  }

  // Request logger (unless quiet)
  if (!options.quiet) {
    app.use((req, _res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${req.method} ${req.url}`);
      next();
    });
  }

  // API routes
  const router = createRouter(db, options);
  app.use(router);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  return app;
}

/**
 * Start the server
 * 
 * @param app - Express application
 * @param options - Server options (port, host)
 * @returns Server instance
 */
export function startServer(app: Express, options: Pick<ServerOptions, 'port' | 'host' | 'quiet'> = {}): ReturnType<Express['listen']> {
  const port = options.port || 3000;
  const host = options.host || 'localhost';

  return app.listen(port, host, () => {
    if (!options.quiet) {
      console.log();
      console.log(`🚀 API Faker is running!`);
      console.log();
      console.log(`  Resources:`);
      console.log(`  http://${host}:${String(port)}/`);
      console.log();
      console.log(`  Home:`);
      console.log(`  http://${host}:${String(port)}`);
      console.log();
    }
  });
}
