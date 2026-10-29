// Minimal type declaration for the workerd-only `cloudflare:workers` module,
// imported by src/core/db/d1.ts (D1 binding) and src/core/db/postgres.ts
// (Hyperdrive binding). The real module only exists inside the Workers
// runtime; local dev resolves it to src/core/db/cloudflare-workers-stub.ts via
// the vite.config.ts alias. Call sites narrow `env` to the binding shape they
// need, so a loose record is enough here — no @cloudflare/workers-types dep.
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
