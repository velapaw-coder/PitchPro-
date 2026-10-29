// `cloudflare:workers` only resolves inside the Workers runtime. This file is
// loaded lazily by createDb() based on DATABASE_PROVIDER, so the import is only
// hit when running on Workers with DATABASE_PROVIDER=d1.
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';

// Minimal D1Database type to avoid pulling in @cloudflare/workers-types globally
type D1Database = {
  prepare(query: string): any;
  batch(statements: any[]): Promise<any[]>;
  exec(query: string): Promise<any>;
  dump(): Promise<ArrayBuffer>;
};

let d1DbInstance: ReturnType<typeof drizzle> | null = null;

function getD1Binding(): D1Database {
  const binding = (env as { DB?: D1Database }).DB;
  if (!binding) {
    throw new Error(
      'D1 binding `DB` not found on cloudflare:workers env. Confirm `d1_databases` (binding: DB) is set in wrangler.jsonc.'
    );
  }
  return binding;
}

export function createD1Db() {
  if (d1DbInstance) return d1DbInstance;
  d1DbInstance = drizzle(getD1Binding());
  return d1DbInstance;
}
