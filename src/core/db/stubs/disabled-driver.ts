// Vinext build stub for DB drivers that aren't needed at Workers runtime.
// vite.config.ts aliases the drivers NOT matching wrangler.jsonc's
// vars.DATABASE_PROVIDER to this file when building for Cloudflare
// (d1 → stub libsql/mysql2/postgres; postgresql → stub libsql/mysql2 and keep
// postgres for Hyperdrive). The stubbed createXxxDb call paths are never
// reached at runtime, so the throws below should never fire in production. The
// stubs only have to satisfy module-load-time imports, not actual usage.

function throwDisabled(): never {
  throw new Error(
    'This DB driver was stubbed out of the Cloudflare Workers build because it ' +
      'does not match vars.DATABASE_PROVIDER in wrangler.jsonc. If you see this ' +
      'error, make sure DATABASE_PROVIDER in wrangler.jsonc.vars matches the ' +
      'database you intend to use (d1, or postgresql with a Hyperdrive binding), ' +
      'then rebuild.'
  );
}

// Satisfies `import { createClient } from '@libsql/client'`
export const createClient = throwDisabled;

// Satisfies `import { drizzle } from 'drizzle-orm/libsql'` (and mysql2 / postgres-js)
export const drizzle = throwDisabled;

// Default-export covers `import mysql from 'mysql2'` and `import postgres from 'postgres'`.
// Wrap in a Proxy so any property access (e.g. mysql.createConnection) returns a throwing fn.
const stubDefault = new Proxy(
  throwDisabled as unknown as Record<string, unknown>,
  {
    get(_target, _prop) {
      return throwDisabled;
    },
  }
);

export default stubDefault;
