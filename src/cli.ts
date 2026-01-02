import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Database } from './database';
import { createServer, startServer, ServerOptions } from './server';

/**
 * CLI configuration interface
 */
interface CliConfig {
  source: string | undefined;
  port: number;
  host: string;
  watch: boolean;
  routes: string | undefined;
  middlewares: string[] | undefined;
  static: string | undefined;
  readOnly: boolean;
  noCors: boolean;
  noGzip: boolean;
  snapshots: string;
  delay: number | undefined;
  id: string;
  foreignKeySuffix: string;
  quiet: boolean;
  config: string;
}

/**
 * Get package version
 */
function getVersion(): string {
  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
    ) as { version: string };
    return packageJson.version;
  } catch {
    return '0.0.0';
  }
}

/**
 * Parse and validate CLI arguments
 */
function parseCli(): CliConfig {
  const argv = yargs(hideBin(process.argv))
    .scriptName('api-faker')
    .usage('Usage: $0 [options] <source>')
    .example('$0 db.json', 'Start API Faker with db.json')
    .example('$0 file.js', 'Start API Faker with a JS file')
    .example('$0 http://example.com/db.json', 'Start API Faker with a remote schema')
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Path to config file',
      default: 'api-faker.json',
    })
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'Set port',
      default: 3000,
    })
    .option('host', {
      alias: 'H',
      type: 'string',
      description: 'Set host',
      default: 'localhost',
    })
    .option('watch', {
      alias: 'w',
      type: 'boolean',
      description: 'Watch file(s)',
      default: false,
    })
    .option('routes', {
      alias: 'r',
      type: 'string',
      description: 'Path to routes file',
    })
    .option('middlewares', {
      alias: 'm',
      type: 'array',
      description: 'Paths to middleware files',
    })
    .option('static', {
      alias: 's',
      type: 'string',
      description: 'Set static files directory',
    })
    .option('read-only', {
      alias: 'ro',
      type: 'boolean',
      description: 'Allow only GET requests',
      default: false,
    })
    .option('no-cors', {
      alias: 'nc',
      type: 'boolean',
      description: 'Disable Cross-Origin Resource Sharing',
      default: false,
    })
    .option('no-gzip', {
      alias: 'ng',
      type: 'boolean',
      description: 'Disable GZIP Content-Encoding',
      default: false,
    })
    .option('snapshots', {
      alias: 'S',
      type: 'string',
      description: 'Set snapshots directory',
      default: '.',
    })
    .option('delay', {
      alias: 'd',
      type: 'number',
      description: 'Add delay to responses (ms)',
    })
    .option('id', {
      alias: 'i',
      type: 'string',
      description: 'Set database id property',
      default: 'id',
    })
    .option('foreignKeySuffix', {
      alias: 'fks',
      type: 'string',
      description: 'Set foreign key suffix',
      default: 'Id',
    })
    .option('quiet', {
      alias: 'q',
      type: 'boolean',
      description: 'Suppress log messages from output',
      default: false,
    })
    .help('help', 'Show help')
    .alias('h', 'help')
    .version(getVersion())
    .alias('v', 'version')
    .epilogue('For more information, visit https://github.com/yourusername/api-faker')
    .parseSync();

  return {
    source: argv._[0] as string | undefined,
    port: argv.port,
    host: argv.host,
    watch: argv.watch,
    routes: argv.routes,
    middlewares: argv.middlewares as string[] | undefined,
    static: argv.static,
    readOnly: argv['read-only'],
    noCors: argv['no-cors'],
    noGzip: argv['no-gzip'],
    snapshots: argv.snapshots,
    delay: argv.delay,
    id: argv.id,
    foreignKeySuffix: argv.foreignKeySuffix,
    quiet: argv.quiet,
    config: argv.config,
  };
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const config = parseCli();

  if (!config.quiet) {
    console.log(`
  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║         API Faker v${getVersion().padEnd(17)}║
  ║                                       ║
  ╚═══════════════════════════════════════╝
    `);
  }

  if (!config.source) {
    console.error('Error: No source file specified');
    console.log('Run "api-faker --help" for usage information');
    process.exit(1);
  }

  if (!config.quiet) {
    console.log(`Source:  ${config.source}`);
    console.log(`Port:    ${String(config.port)}`);
    console.log(`Host:    ${config.host}`);
    console.log();
    console.log('Loading database...');
  }

  try {
    // Initialize database
    const db = new Database(config.source, {
      idField: config.id,
      foreignKeySuffix: config.foreignKeySuffix,
    });

    await db.init();

    if (!config.quiet) {
      const data = db.getData();
      const resources = Object.keys(data);
      console.log(`Loaded ${String(resources.length)} resource(s): ${resources.join(', ')}`);
      console.log();
    }

    // Create and start server
    const serverOptions: ServerOptions = {
      port: config.port,
      host: config.host,
      readOnly: config.readOnly,
      noCors: config.noCors,
      noGzip: config.noGzip,
      quiet: config.quiet,
      idField: config.id,
      foreignKeySuffix: config.foreignKeySuffix,
    };

    // Only add delay if it's defined
    if (config.delay !== undefined) {
      serverOptions.delay = config.delay;
    }

    const app = createServer(db, serverOptions);

    startServer(app, {
      port: config.port,
      host: config.host,
      quiet: config.quiet,
    });

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run CLI
main().catch((error: unknown) => {
  console.error('Fatal error:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
