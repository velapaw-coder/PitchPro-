import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import mdx from '@mdx-js/rollup';
import vinext from 'vinext';
import { defineConfig } from 'vite';

// Dev uses Node so the Drizzle drivers (@libsql/client, mysql2, postgres) work
// against a local DB. Build uses the Cloudflare plugin so `vinext build` and
// `vinext deploy` produce a Workers-compatible bundle.
//
// Toggle dev → Workers mode by exporting VINEXT_CLOUDFLARE_DEV=1 — useful when
// you need realistic workerd semantics, but expect the Node-native DB drivers
// to fail and to wire D1/HTTP-based drivers instead.
const isBuild =
  process.argv.includes('build') || process.argv.includes('deploy');
const useCloudflare = isBuild || process.env.VINEXT_CLOUDFLARE_DEV === '1';

// Which DB the Workers bundle targets. Runtime truth is wrangler.jsonc
// `vars.DATABASE_PROVIDER` (that's what src/core/db reads on workerd), so
// prefer it over the build-time env, which can be polluted by .env.local.
function workersDbProvider(): string {
  try {
    const raw = readFileSync(
      new URL('./wrangler.jsonc', import.meta.url),
      'utf8'
    );
    const m = raw.match(/"DATABASE_PROVIDER"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
  } catch {
    // no wrangler.jsonc yet (fresh clone) — fall through
  }
  return process.env.DATABASE_PROVIDER || 'd1';
}

const workersDb = useCloudflare ? workersDbProvider() : '';
// postgres runs on Workers (nodejs_compat) — keep its driver in the bundle and
// let src/core/db/postgres.ts pick up the Hyperdrive binding at runtime.
const keepPostgres = workersDb === 'postgresql' || workersDb === 'postgres';

export default defineConfig({
  plugins: [
    // MDX must run before vinext/RSC so `.mdx` files are already JSX by the time
    // RSC analyzes them. No `providerImportSource` — @mdx-js/react's MDXProvider
    // calls `React.createContext`, which is unavailable in the RSC environment.
    // Pages should pass component overrides directly via the `components` prop.
    { ...mdx(), enforce: 'pre' },
    vinext(),
    ...(useCloudflare
      ? [
          cloudflare({
            viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
          }),
        ]
      : []),
  ],
  optimizeDeps: {
    exclude: ['next-intl'],
  },
  resolve: {
    alias: useCloudflare
      ? [
          // Cloudflare build: only the provider named in wrangler.jsonc
          // `vars.DATABASE_PROVIDER` runs at Workers runtime. The unused DB
          // drivers and their drizzle sub-paths are pulled in by static imports
          // in src/core/db/{sqlite,mysql,postgres}.ts but their createXxxDb()
          // is never called. Alias them to a throwing stub to shave
          // ~150-300 KB gzipped from the Worker script (plus their transitive
          // CJS deps like iconv-lite). With DATABASE_PROVIDER=postgresql the
          // postgres driver stays real (it works under nodejs_compat) and
          // connects through the Hyperdrive binding.
          ...[
            '@libsql/client',
            'drizzle-orm/libsql',
            'mysql2',
            'drizzle-orm/mysql2',
            ...(keepPostgres ? [] : ['postgres', 'drizzle-orm/postgres-js']),
          ].map((find) => ({
            find,
            replacement: fileURLToPath(
              new URL('./src/core/db/stubs/disabled-driver.ts', import.meta.url)
            ),
          })),
        ]
      : [
          // Dev (no @cloudflare/vite-plugin): `cloudflare:workers` doesn't resolve
          // because it's a workerd-only built-in. src/core/db/{d1,postgres}.ts
          // statically import `{ env }` from it for the D1/Hyperdrive bindings;
          // even though those code paths are never hit in local dev, the static
          // import is parsed and fails module resolution. Alias to a stub that
          // throws on actual access.
          {
            find: 'cloudflare:workers',
            replacement: fileURLToPath(
              new URL(
                './src/core/db/cloudflare-workers-stub.ts',
                import.meta.url
              )
            ),
          },
        ],
  },
  ssr: {
    // Node-native DB drivers + their transitive CJS deps must bypass Vite's CJS interop
    // (Vite's `const module = { exports }` injection collides with `var module = ...` in
    // older CJS files like iconv-lite/encodings/index.js). Loading them via Node keeps
    // the original CJS scoping intact.
    // When the Workers bundle keeps postgres (Hyperdrive), it must be BUNDLED,
    // not externalized — workerd can't require() external node modules.
    external: [
      'mysql2',
      '@libsql/client',
      'iconv-lite',
      ...(keepPostgres ? [] : ['postgres']),
    ],
  },
});
