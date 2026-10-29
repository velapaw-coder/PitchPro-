---
name: deploy-cloudflare
description: "Deploy this project to Cloudflare Workers via vinext. Auto-handles D1 setup, secrets, schema push, and redeploy. Use when the user says 'deploy to cloudflare', 'ship to workers', 'push to cf', '部署到 cloudflare', or asks how to publish to Workers. This repo (shipany-vinext) is Cloudflare-native — runs on any branch."
argument-hint: "[--preview to deploy to a preview environment]"
user-invocable: true
---

# Deploy to Cloudflare Workers — $ARGUMENTS

You are driving a Cloudflare Workers deployment via `vinext deploy`. This repo (shipany-vinext) is Cloudflare-native — every branch builds with Vite + `@cloudflare/vite-plugin`. (Its upstream, shipany-next, targets Node/Docker/Vercel and must NOT be deployed with this skill.)

## Database backend: D1 (default) or Postgres via Hyperdrive

Two supported backends on Workers, chosen by `wrangler.jsonc` `vars.DATABASE_PROVIDER`:

| | **D1** (`d1`) | **Postgres + Hyperdrive** (`postgresql`) |
|---|---|---|
| When | Default. Zero external infra. | User already has a Postgres (Neon/Supabase/RDS/self-hosted) or needs PG features |
| Binding | `d1_databases` → `DB` | `hyperdrive` → `HYPERDRIVE` (`src/core/db/postgres.ts` reads `connectionString` at runtime) |
| Schema push | `wrangler d1 migrations apply --remote` | `pnpm db:migrate` directly against the real PG (NOT through Hyperdrive) |
| RBAC seed / admin | local-sqlite dump dance (Phase 4.5 / 9) | `pnpm rbac:init` directly against PG — no dance needed |
| Bundle | postgres driver stubbed out | postgres driver kept (vite.config.ts reads `vars.DATABASE_PROVIDER`) |

**Backend selection:** if `wrangler.jsonc` already has a populated `hyperdrive` or `d1_databases` binding, keep that backend (incremental run). On first-time setup, default to D1 unless the user mentioned Postgres/Hyperdrive/Neon/Supabase or `$ARGUMENTS` contains `--db=postgres` — then use the **Phase 3-PG** variant below.

If the chosen backend is Postgres: Phases 4 (D1 migrations), 4.5 (local-sqlite RBAC dance), and 9's D1 SQL steps are REPLACED by their direct-PG equivalents in Phase 3-PG step 4 — drizzle and `init-rbac.ts`/`assign-role.ts` talk to PG natively with `DATABASE_PROVIDER=postgresql DATABASE_URL=<direct PG url>`.

## Philosophy: minimal interruptions, fully idempotent

The skill is designed to be run **any number of times**. A repeat invocation auto-detects what's already done and only redoes what's needed (e.g. a fresh build + deploy with the latest code). User interaction is capped at:

1. **Cloudflare authorization** — skipped if `wrangler whoami` already shows authenticated.
2. **Final deploy confirmation** — always asked; deploy is irreversible.
3. **(Optional) Admin credentials** — only asked on first deploy when no `super_admin` exists yet. User picks one of: `email password` (agent creates the account directly so user can log in immediately), `email` (promote an existing user — requires prior sign-up via web), or `skip` (assign later with `/deploy-cloudflare --admin-email=X --admin-password=Y` or `--admin=X`).

Every other step (D1 create, schema migrations, RBAC seed, secrets, URL fixup) is automatic AND idempotent. So **"再发布一下" / "ship again"** = run `/deploy-cloudflare` again. Phase 2 detects existing state, every gated phase skips itself, only Phase 6's confirmation fires.

### Idempotency cheat sheet

| Phase | Skip when | Re-run action |
|---|---|---|
| 0.3 Login | `wrangler whoami` is authed | No-op |
| 3 First-time setup | D1 named `<worker>` exists AND `wrangler.jsonc` populated AND Worker deployed before | Skip the entire Phase 3 block |
| 4 Schema migrations | local `drizzle/meta/_journal.json` entry count == `wrangler d1 migrations list --remote` applied count | Skip apply (wrangler itself is idempotent so re-running is safe — we skip for speed) |
| 4.5 RBAC seed | `SELECT COUNT(*) FROM role` returns ≥ 1 on remote D1 | Skip local-sqlite dance entirely |
| 5 Secrets | `wrangler secret list` already contains the name | Skip per-secret upload (use `/deploy-cloudflare --rotate-secrets` to force re-upload) |
| 5.5 Production URL | `.env.production` URL AND `wrangler.jsonc.vars.NEXT_PUBLIC_APP_URL` are both consistent with `wrangler.jsonc` routes (workers.dev + no routes, OR custom domain matching a routes pattern) | Skip the prompt (use `/deploy-cloudflare --domain=X` to override) |
| 6 Deploy | (always runs) | Fresh `pnpm run deploy` with the latest code/env |
| 7 URL fix | Both `.env.production`'s `NEXT_PUBLIC_APP_URL` AND `wrangler.jsonc.vars.NEXT_PUBLIC_APP_URL` already match the deployed URL (custom domains hit this immediately) | Skip redeploy |
| 9 Admin | `SELECT COUNT(*) FROM user_role ur JOIN role r ON r.id=ur.role_id WHERE r.name='super_admin'` ≥ 1 | Don't prompt (still runs if explicit `--admin-email=X --admin-password=Y` for create or `--admin=X` for promote) |

If the agent's auto-picked resource names don't fit, the user can interject — agent narrates names BEFORE acting so user has a chance to say "rename to X".

## Hard rules (do not violate)

1. **Repo check first.** If `vite.config.ts` or `wrangler.example.jsonc` is missing, this is NOT the Cloudflare-native repo (you may be in upstream shipany-next) — STOP.
2. **Never auto-run the final `pnpm run deploy` / `vinext deploy`.** This is the irreversible production push — always confirm. Redeploys to fix a baked URL after the first deploy are part of the same deploy event and do not need re-confirmation.
3. **Never echo secret values to the user.** Generate secrets via `openssl`; pipe values from `.env.local` directly into `wrangler secret put` (`cut -d= -f2- | wrangler ...`). Never `cat .env.local` in front of the user.
4. **Use `pnpm run deploy`, not `pnpm deploy`.** pnpm intercepts `pnpm deploy` as a workspace command and errors out.
5. **Always source `.env.production` BEFORE `vinext deploy`.** Vite's env precedence is `.env.local` > `.env.production`, so if the developer has localhost URLs in `.env.local` (normal for dev), they get baked into the server bundle. Use the wrapper script in Phase 6 / Phase 0.4 — never call raw `vinext deploy` for a prod deploy.
6. **Admin password handling (Phase 9.A):** the user types the password into chat (visible once), the agent passes it to `init-rbac.ts --admin-password=...`, and **never echoes it back**. Don't include it in narration, status updates, commit messages, or `.env*` files. The hashed form lives in D1 via better-auth/crypto. Remind the user they can rotate it via the app's `/settings` after first login.

## Phase 0: Preflight

### 0.1 Repo check

```bash
test -f vite.config.ts && test -f wrangler.example.jsonc && echo OK
```

If either file is missing, STOP — this is not the Cloudflare-native repo (you may be in upstream `shipany-next`, which targets Node/Docker/Vercel). Clone `shipany-ai/shipany-vinext` instead.

### 0.2 Tool check (parallel)

```bash
node -v                                  # vinext needs Node 20+
pnpm -v
npx wrangler --version
test -f wrangler.example.jsonc && echo OK
test -f vite.config.ts && echo OK
test -f .env.production.example && echo OK
git status --short
```

If `wrangler.example.jsonc` or `vite.config.ts` is missing, the project hasn't completed vinext migration. Direct the user to the `migrate-to-vinext` skill first.

### 0.3 Wrangler login (Interruption #1)

**Skip if:** `npx wrangler whoami` already shows authenticated. Just capture the account name + ID and move on.

```bash
npx wrangler whoami
```

If output includes "You are not authenticated", run login directly — this opens the user's browser automatically:

```bash
npx wrangler login
```

Tell the user (one short sentence):
> Opened the Cloudflare authorization page in your browser — click "Authorize" to grant access. I'll continue automatically once it completes.

Use a long timeout (`300000` ms / 5 min) since user has to click in browser. The CLI exits with success once authorized. On success, re-run `npx wrangler whoami` to capture account name + ID; remember the account ID for Phase 1's first-time-detection API calls.

If `wrangler login` fails (timeout, user cancels), surface and ask if they want to retry.

### 0.4 Repair `package.json` `scripts.deploy` if needed

**Skip if:** the script already starts with `sh -c 'set -a` (the env-sourcing wrapper).

vinext init scaffolds `"deploy": "vinext deploy"`, which doesn't source `.env.production` before building. That causes `.env.local` (typically with a localhost URL) to override prod values and get baked into the server bundle — breaking better-auth `trustedOrigins`, Stripe callback URLs, and metadata canonicals.

If the script is the raw `vinext deploy`, replace it with:

```jsonc
"deploy": "sh -c 'set -a && [ -f .env.production ] && . ./.env.production; set +a && exec npx vinext deploy'"
```

Narrate: "Fixed `package.json` deploy script to source `.env.production` before building (avoids the `.env.local` override trap)."

### 0.5 Local build sanity check

```bash
pnpm build
```

If it fails, fix the build error before touching deployment. Don't proceed with a broken build. Narrate "build OK" on success and move on.

## Phase 1: Compatibility scan (informational, parallel, no prompts)

Run in parallel and report findings as a single table. Do NOT pause for user input — this is informational. If something looks like a blocker (e.g. D1 binding stub still throws AND DATABASE_PROVIDER will become `d1`), the fix happens automatically in Phase 3.

```bash
grep -E "^\s+\"(mysql2|postgres|@libsql/client|sharp|resvg|satori|canvas|playwright|puppeteer)\":" package.json
grep -n "throw new Error" src/core/db/d1.ts
grep DATABASE_PROVIDER .env.local
grep -n "case 'd1'" src/core/auth/index.ts
grep STORAGE_PROVIDER .env.local
```

Render a 5-row table: dep status, D1 stub status, current DATABASE_PROVIDER, better-auth d1 mapping, storage backend.

## Phase 2: First-time vs incremental detection

This is the **central detection step**. Run all checks in parallel and remember the results — every later phase reads them to decide skip vs run.

```bash
WORKER=$(jq -r .name package.json)
DB_NAME="$WORKER"   # default; may be overridden by user in Phase 3.1

# Resource existence
npx wrangler d1 list 2>&1 | grep -w "$DB_NAME"                       # D1 created?
test -f wrangler.jsonc && grep -q '"database_id":' wrangler.jsonc && ! grep -q 'REPLACE_WITH_OUTPUT_OF_WRANGLER_D1_CREATE' wrangler.jsonc    # wrangler.jsonc populated with real D1 id (not placeholder)?
npx wrangler deployments list --name "$WORKER" 2>&1 | grep -q 'Created'  # Worker ever deployed?

# Schema delta
LOCAL_MIGRATIONS=$(jq '.entries | length' drizzle/meta/_journal.json 2>/dev/null || echo 0)
REMOTE_MIGRATIONS=$(npx wrangler d1 migrations list "$DB_NAME" --remote 2>&1 | grep -cE '^\| [0-9]{4}_' || echo 0)

# RBAC state
ROLE_COUNT=$(npx wrangler d1 execute "$DB_NAME" --remote --command="SELECT COUNT(*) AS c FROM role" --json 2>/dev/null | jq '.[0].results[0].c // 0' || echo 0)

# Secrets state
SECRETS_SET=$(npx wrangler secret list 2>&1 | jq -r '.[].name' 2>/dev/null || echo "")

# Admin state
ADMIN_COUNT=$(npx wrangler d1 execute "$DB_NAME" --remote --command="SELECT COUNT(*) AS c FROM user_role ur JOIN role r ON r.id=ur.role_id WHERE r.name='super_admin'" --json 2>/dev/null | jq '.[0].results[0].c // 0' || echo 0)

# Local env state
test -f .env.production && grep "^NEXT_PUBLIC_APP_URL=" .env.production | cut -d= -f2-
```

Decide & narrate state to user (one line each):

> Detection:
> - D1 `shipany-next`: ✓ exists
> - wrangler.jsonc: ✓ populated
> - Prior Worker deploy: ✓ (last: <timestamp>)
> - Schema migrations: 3/3 applied
> - RBAC seeded: ✓ (12 roles, 60 permissions)
> - Secrets set: AUTH_SECRET ✓ STRIPE_SECRET_KEY ✓
> - Admin assigned: ✓ (1 super_admin)
> - Run mode: **incremental** — skipping Phases 3, 4, 4.5, 5, 9. Building + redeploying.

Branch:
- **First-time** if ANY core resource missing (no D1, no `wrangler.jsonc` binding, or no prior deployment). → Continue to Phase 3.
- **Incremental** otherwise. Phases below auto-skip based on detection. → Continue to Phase 4 to pick up any new migrations.

## Phase 3: First-time setup — announce, pause once, then auto-execute everything

**Skip entire Phase 3 if:** Phase 2 detected all of (D1 exists + wrangler.jsonc has binding + prior deployment). Narrate "Resources already set up, skipping Phase 3" and jump to Phase 4.

### 3.1 Show the plan and pause for a single OK

Build a single message like:

> First-time Cloudflare setup. I'll do all of this in one shot — you only need to act if you want different names.
>
> **Resources to create:**
> - Cloudflare Worker:  `shipany-next`     (from package.json `name`)
> - D1 Database:        `shipany-next`     (matches worker)
>
> **Automatic edits:**
> - `wrangler.jsonc` (copied from `wrangler.example.jsonc` template, then populated with the D1 binding)
> - `src/core/db/d1.ts` (wire `getD1Binding()` to `env.DB`)
>
> **Then I'll:**
> 1. Push the Drizzle schema to D1 (`wrangler d1 migrations apply --remote`)
> 2. Seed default RBAC roles + permissions (`super_admin` etc. into the `role` / `permission` / `role_permission` tables)
> 3. Generate + set `AUTH_SECRET` (random 32-byte, never shown)
> 4. Pipe any other secrets from `.env.local` into `wrangler secret put`
> 5. Ask you to pick the production URL — workers.dev default or your custom domain
> 6. Deploy. If you picked workers.dev placeholder, redeploy once with the real URL.
> 7. After deploy, ask you to sign up via the live URL and tell me your email to grant `super_admin` (you can skip and assign later)
>
> Reply `ok` (or just don't interrupt — I'll start in a moment), or `rename worker=X db=Y` to change names.

Wait briefly. If the user objects within ~5 seconds equivalent of conversation turns, honor the rename. Otherwise proceed.

### 3.2 Create D1 database (auto)

```bash
npx wrangler d1 create <db-name>
```

Capture from stdout: the `database_id` UUID. Narrate: "D1 created: `<name>` (id: `<id>`)".

### 3.3 Materialize `wrangler.jsonc` from the example (auto)

```bash
test -f wrangler.jsonc || cp wrangler.example.jsonc wrangler.jsonc
```

Then Edit `wrangler.jsonc`:
- Replace `name` with the chosen worker name (default = package.json name)
- Replace `database_name` with the chosen D1 name
- Replace `REPLACE_WITH_OUTPUT_OF_WRANGLER_D1_CREATE` with the actual UUID from 3.2

Confirm `vars.DATABASE_PROVIDER` is `"d1"` (the example already sets this).

### 3.4 Wire `getD1Binding` to `env.DB` (auto)

Edit `src/core/db/d1.ts` to replace the stub `throw new Error(...)` with reading from `cloudflare:workers`:

```ts
import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:workers';

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
      'D1 binding `DB` not found. Confirm `d1_databases` (binding: DB) is set in wrangler.jsonc.'
    );
  }
  return binding;
}

export function createD1Db() {
  if (d1DbInstance) return d1DbInstance;
  d1DbInstance = drizzle(getD1Binding());
  return d1DbInstance;
}
```

If the file already reads from `env.DB`, leave it alone.

**Critical companion step — stub `cloudflare:workers` for local dev:** the `import { env } from 'cloudflare:workers'` line above is a STATIC import. Vite/Node parses it at module load time even if `createD1Db()` is never called (e.g. when `DATABASE_PROVIDER=sqlite` locally). `cloudflare:workers` only resolves inside workerd, so `pnpm dev` immediately errors with `Cannot find module 'cloudflare:workers'` from `src/core/db/d1.ts`. Fix in two parts:

#### Create the stub

Write `src/core/db/cloudflare-workers-stub.ts`:

```ts
// Dev-only stub for the `cloudflare:workers` module.
// vite.config.ts aliases `cloudflare:workers` to this file when running outside
// the Workers runtime (i.e. `pnpm dev` on Node). Production deploys go through
// @cloudflare/vite-plugin which provides the real module.
//
// Actual access throws a helpful message — d1.ts is only loaded when
// DATABASE_PROVIDER=d1, which should never be set in local dev.
export const env = new Proxy({}, {
  get(_, prop) {
    throw new Error(
      `cloudflare:workers env.${String(prop)} accessed in non-Workers runtime. ` +
      `Did you set DATABASE_PROVIDER=d1 in local dev? Use sqlite/postgres/mysql locally.`
    );
  },
});
```

#### Wire the alias into `vite.config.ts`

Add `resolve.alias` (conditional on the same `useCloudflare` flag that gates the cloudflare plugin):

```ts
import { fileURLToPath } from "node:url";
// ...inside defineConfig({ ... })
resolve: {
  alias: useCloudflare
    ? []
    : [
        {
          find: "cloudflare:workers",
          replacement: fileURLToPath(
            new URL("./src/core/db/cloudflare-workers-stub.ts", import.meta.url)
          ),
        },
      ],
},
```

In dev (`useCloudflare=false`), Vite intercepts `cloudflare:workers` imports → stub. In build/deploy (`useCloudflare=true`), `@cloudflare/vite-plugin` handles the real binding so the alias is empty.

### 3.5 (Removed)

`.env.production` creation moved to Phase 5.5 — it's tied to the production URL choice and shouldn't be created before that decision.

## Phase 3-PG: First-time setup — Postgres + Hyperdrive variant

Use INSTEAD of Phase 3 when the backend decision (see "Database backend" above) is Postgres. Also REPLACES Phases 4 and 4.5 — schema and RBAC go directly to PG. Phase 9's admin steps run via `pnpm rbac:init` / `rbac:assign` against PG (no D1 SQL).

### 1. Get the connection string

Ask the user for their Postgres connection string if it's not already in `.env.local`/`.env.development` (`DATABASE_URL=postgres://...`). Requirements: publicly reachable from Cloudflare (or via Hyperdrive-supported access methods), TLS recommended. Treat the URL as a secret — never echo it back (it embeds the password).

### 2. Create the Hyperdrive config (auto)

```bash
# pipe, don't paste into argv history where avoidable; name defaults to the worker name
npx wrangler hyperdrive create <worker-name> --connection-string="$DATABASE_URL"
```

Capture the `id` from stdout. Narrate: "Hyperdrive created: `<name>` (id: `<id>`)". If it errors with "could not connect", the PG isn't reachable from Cloudflare — surface the error and stop (common causes: IP allowlist, no TLS, non-5432 port blocked).

### 3. Materialize `wrangler.jsonc` (auto)

```bash
test -f wrangler.jsonc || cp wrangler.example.jsonc wrangler.jsonc
```

Edit `wrangler.jsonc`:
- `name` ← chosen worker name
- `vars.DATABASE_PROVIDER` ← `"postgresql"` (this also tells vite.config.ts to keep the postgres driver in the Worker bundle)
- REMOVE the `d1_databases` block
- ADD: `"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<id from step 2>" }]`

Do NOT put `DATABASE_URL` in `vars` (vars are public). The runtime reads the connection string from the Hyperdrive binding; `DATABASE_URL` is only needed as a **secret** fallback if the user insists on running without Hyperdrive (discouraged): `grep "^DATABASE_URL=" .env.local | cut -d= -f2- | npx wrangler secret put DATABASE_URL`.

### 4. Schema + RBAC directly against PG (auto, replaces Phases 4 & 4.5)

```bash
# Schema: drizzle talks to the real PG directly (NOT through Hyperdrive)
DATABASE_PROVIDER=postgresql DATABASE_URL="$PG_URL" pnpm db:migrate

# RBAC seed (idempotent — init-rbac has its own existence checks)
DATABASE_PROVIDER=postgresql DATABASE_URL="$PG_URL" pnpm rbac:init
```

If `drizzle/` has no PG migrations yet (journal dialect mismatch with a previous sqlite/d1 setup), run `pnpm db:generate` first; if the journal is for another dialect, move the old `drizzle/` aside (`mv drizzle drizzle.d1.bak`) and generate fresh.

Skip-detection for incremental runs: `SELECT COUNT(*) FROM role` via a quick `psql`-less check — run `DATABASE_PROVIDER=postgresql DATABASE_URL="$PG_URL" pnpm rbac:init` anyway; it's a no-op when seeded.

### 5. Admin (replaces Phase 9's D1 SQL)

```bash
# create-account mode
DATABASE_PROVIDER=postgresql DATABASE_URL="$PG_URL" pnpm rbac:init --admin-email="$EMAIL" --admin-password="$PASS"
# promote-existing mode
DATABASE_PROVIDER=postgresql DATABASE_URL="$PG_URL" pnpm rbac:assign "$EMAIL" super_admin
```

Then continue with Phase 5 (secrets), 5.5 (URL), 6 (deploy) unchanged.

## Phase 4: Schema push to D1 (auto, incremental)

**Skip entirely if the backend is Postgres** — Phase 3-PG step 4 already handled schema.

**Skip if:** Phase 2 found `LOCAL_MIGRATIONS == REMOTE_MIGRATIONS`. Narrate "Schema up to date (N migrations applied), skipping".

Otherwise apply just the new ones (wrangler is inherently idempotent — applied migrations are not re-applied):

```bash
pnpm db:generate
```

If this prompts for column conflicts (drizzle-kit's TTY-only prompt; will fail with "Interactive prompts require a TTY"), surface the error and ask the user to run `pnpm db:generate` once in their own terminal answering the prompts, then say "done" to continue.

```bash
echo y | npx wrangler d1 migrations apply <db-name> --remote
```

Narrate: "Applied N migrations to D1 (<X> SQL commands)."

## Phase 4.5: Seed default RBAC roles + permissions (auto, no prompt)

**Skip if:** Phase 2 found `ROLE_COUNT > 0`. Narrate "RBAC already seeded (N roles), skipping". Force with `/deploy-cloudflare --force-rbac` if defaults changed.

The project ships `scripts/init-rbac.ts` which populates `role`, `permission`, and `role_permission` tables with defaults (`super_admin`, etc.). The script uses libsql/postgres/mysql clients directly — it can't talk to remote D1. Workaround: run it against a wrangler-managed local D1 (which is just SQLite under `.wrangler/state/`), dump the seeded rows as SQL, and apply to remote D1 via `wrangler d1 execute`.

Steps (all automatic):

```bash
# 1. Apply schema to local D1 so init-rbac has tables to write to
npx wrangler d1 migrations apply <db-name> --local

# 2. Locate the local D1 SQLite file
LOCAL_D1=$(find .wrangler/state -name "*.sqlite3" -path "*/d1/*" | head -1)

# 3. Run init-rbac against the local D1 file via libsql client
DATABASE_PROVIDER=sqlite DATABASE_URL="file:$LOCAL_D1" pnpm rbac:init

# 4. Dump only the seeded rows (skip CREATE/PRAGMA/transaction wrappers)
sqlite3 "$LOCAL_D1" ".dump role permission role_permission" \
  | grep "^INSERT INTO" \
  > /tmp/rbac-seed.sql

# 5. Apply to remote D1 (idempotent — INSERT OR IGNORE if rows already there)
#    First convert plain INSERTs to INSERT OR IGNORE for re-runnability
sed -i.bak 's/^INSERT INTO/INSERT OR IGNORE INTO/' /tmp/rbac-seed.sql
npx wrangler d1 execute <db-name> --remote --file=/tmp/rbac-seed.sql
```

Narrate: "Seeded RBAC: N roles, M permissions."

**Preconditions:** `sqlite3` CLI must be on the user's PATH (default on macOS, usually present on Linux). If missing, surface an actionable error: "Install sqlite3 (`brew install sqlite` on mac, `apt-get install sqlite3` on Debian/Ubuntu) and re-run."

**Re-runs are safe** because of `INSERT OR IGNORE` and `init-rbac.ts`'s own existence checks.

## Phase 5: Secrets and vars (auto, never expose values)

**Per-secret skip:** if `SECRETS_SET` (from Phase 2) already includes the name, skip the upload. Force a re-upload with `/deploy-cloudflare --rotate-secrets`. Narrate per secret: "AUTH_SECRET ✓ (already set), STRIPE_SECRET_KEY → uploaded fresh from .env.local".

### 5.1 AUTH_SECRET

Detect: read the value from `.env.local`. If missing, or if it matches a dev placeholder (`contains "dev-secret"` OR `"change-in-production"` OR `"placeholder"`), generate a fresh one:

```bash
openssl rand -base64 32 | npx wrangler secret put AUTH_SECRET
```

Else, pipe the existing value:

```bash
grep "^AUTH_SECRET=" .env.local | cut -d= -f2- | npx wrangler secret put AUTH_SECRET
```

Narrate: "Set AUTH_SECRET (generated)" or "Set AUTH_SECRET (from .env.local)".

### 5.2 Other secrets present in `.env.local`

For each of these names IF it exists in `.env.local` with a non-empty value:

- `STRIPE_SECRET_KEY`, `STRIPE_SIGNING_SECRET`, `STRIPE_PAYPAL_SECRET`
- `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `REPLICATE_API_TOKEN`, `GEMINI_API_KEY`, `FAL_KEY`, `KIE_API_KEY`
- `STORAGE_SECRET_KEY`
- Any var matching `*_SECRET`, `*_TOKEN`, `*_PASSWORD`, `*_API_KEY`

Pipe each value:

```bash
grep "^<NAME>=" .env.local | cut -d= -f2- | npx wrangler secret put <NAME>
```

Narrate the list of set secrets (names only). Never echo values.

### 5.3 wrangler.jsonc vars

Already populated by Phase 3.3 — `DATABASE_PROVIDER=d1`. If the user has other non-sensitive server-only runtime config in `.env.local` (e.g. `STORAGE_PROVIDER`, feature flags), Edit `wrangler.jsonc` to add them under `vars`. Skip `NEXT_PUBLIC_*` (those belong in `.env.production`).

## Phase 5.5: Production URL (one prompt unless already set or `--domain=` passed)

**Skip if:** `.env.production` already exists AND its `NEXT_PUBLIC_APP_URL` is consistent with `wrangler.jsonc` (one of):
- URL is a `*.workers.dev` host AND `wrangler.jsonc` has no `routes` entry → user previously chose default
- URL matches a hostname in `wrangler.jsonc` `routes[].pattern` → user previously chose custom domain

If `$ARGUMENTS` includes `--domain=app.example.com`, use it directly (no prompt). Pass `--domain=workers.dev` (or `--domain=default`) to force the default Worker URL without a prompt.

**Otherwise (first-time, or `.env.production` missing/inconsistent)**, prompt the user:

> What URL will the production app run at?
>
> 1. **Default — Cloudflare workers.dev URL** (auto-assigned, no DNS work). Format: `https://<worker>.<your-cf-subdomain>.workers.dev`. I won't know the exact subdomain until after the first deploy.
> 2. **Custom domain you own** — paste it (e.g. `app.example.com`). Requirement: the domain (or its parent zone) must already be a zone in your Cloudflare account. Cloudflare auto-creates the DNS record on deploy.
>
> Reply `1` / `default` / `workers.dev`, or paste a domain.

### 5.5.A On default

```bash
test -f .env.production || cp .env.production.example .env.production
```

Edit `.env.production`:
- `NEXT_PUBLIC_APP_NAME` ← from `.env.local`
- `NEXT_PUBLIC_APP_URL` ← `https://<worker>.workers.dev` (placeholder — Phase 7 will correct after first deploy reveals the real `<account-subdomain>`)

**Also** edit `wrangler.jsonc.vars` to set the same values (server-side `process.env.X` reads from vars at runtime — without this, better-auth's `trustedOrigins` is empty and sign-up returns 403 "Invalid origin"):

```jsonc
"vars": {
  "DATABASE_PROVIDER": "d1",
  "NEXT_PUBLIC_APP_URL": "https://<worker>.workers.dev",
  "NEXT_PUBLIC_APP_NAME": "<value from .env.local>"
}
```

Phase 7 will update BOTH files with the real URL after first deploy.

Do NOT add `routes` to `wrangler.jsonc`. No routes = Worker serves on its default `*.workers.dev` host.

### 5.5.B On custom domain (e.g. `app.example.com`)

```bash
test -f .env.production || cp .env.production.example .env.production
```

Edit `.env.production`:
- `NEXT_PUBLIC_APP_NAME` ← from `.env.local`
- `NEXT_PUBLIC_APP_URL` ← `https://app.example.com` (exact, no placeholder)

Edit `wrangler.jsonc`:

```jsonc
"vars": {
  "DATABASE_PROVIDER": "d1",
  "NEXT_PUBLIC_APP_URL": "https://app.example.com",
  "NEXT_PUBLIC_APP_NAME": "<value from .env.local>"
},
"routes": [
  { "pattern": "app.example.com", "custom_domain": true }
]
```

The `vars.NEXT_PUBLIC_APP_URL` is required for **server-side** code (better-auth `trustedOrigins`, payment callbacks, metadata canonicals). Without it the server `process.env.NEXT_PUBLIC_APP_URL` is undefined and sign-up returns 403 "Invalid origin". The `.env.production` value is for **build-time client bundle inlining**. Both are needed.

(For a subdomain pattern like `*.example.com/api/*` use the older route form: `"routes": [{ "pattern": "*.example.com/api/*", "zone_name": "example.com" }]` — but `custom_domain: true` is the right choice for a single hostname.)

Warn the user before continuing:

> ⚠️ Confirm `app.example.com` (or its parent zone `example.com`) is **already a zone in your Cloudflare account** (Cloudflare dashboard → Websites). If not, the deploy will fail with a "route not in zone" error. Continue? (yes / cancel and add the zone first)

After this phase, Phase 6 deploys with the correct URL baked into the client bundle from the start — no Phase 7 redeploy needed for custom-domain users.

## Phase 6: Deploy — Interruption #2 (the only confirmation)

Show a one-line summary and ask:

> Ready to deploy `<worker-name>` to Cloudflare:
> - Account: `<account-name>` (`<account-id>`)
> - D1: `<db-name>` (`<migration-count>` migrations applied)
> - Secrets set: `<names>`
> - This will create a live Worker URL and is irreversible (the next deploy replaces it).
>
> Proceed? Reply `yes` / `no`.

On `yes`, run via a wrapper that **sources `.env.production` BEFORE invoking vinext**:

```bash
sh -c 'set -a && [ -f .env.production ] && . ./.env.production; set +a && exec npx vinext deploy'
```

**Why the wrapper, not `pnpm run deploy` directly?** Vite/vinext follows the standard env-file precedence (`.env.local` > `.env.production`), so if the developer has `NEXT_PUBLIC_APP_URL=http://localhost:3001` in `.env.local` (typical for local dev), it WINS during a prod build and gets baked into the server bundle. Result: `envConfigs.app_url` at Workers runtime is `http://localhost:3001`, better-auth's `trustedOrigins` returns `["http://localhost:3001"]`, and any browser sign-in from the live URL gets `403 Invalid origin`. Sourcing `.env.production` into the shell BEFORE the build promotes those values to `process.env`, which beats both `.env.local` and `.env.production` in Vite's loadEnv resolution.

If `$ARGUMENTS` contains `--preview`, swap `npx vinext deploy` → `npx vinext deploy --preview` inside the wrapper.

**Ensure `package.json` `scripts.deploy` matches this wrapper** so manual `pnpm run deploy` also works correctly. Phase 0.2 verifies and Phase 0.5 fixes it (see below).

Capture the deployed URL from output (format: `Deployed to: https://<worker>.<account-subdomain>.workers.dev`).

## Phase 7: Fix baked URL and redeploy (auto, no confirmation)

**Skip if:** `.env.production`'s `NEXT_PUBLIC_APP_URL` AND `wrangler.jsonc.vars.NEXT_PUBLIC_APP_URL` BOTH already match the URL Phase 6 just deployed to. Common on:
- Incremental re-runs (URL was correct already)
- Custom-domain users from Phase 5.5.B (URL baked from the start)
- Default users on re-runs after Phase 7 has already done the fixup once

Compare the deployed URL with both `.env.production` AND `wrangler.jsonc.vars`. If either differs, update both and redeploy. Reminder: **must update both** — `.env.production` for client bundle, `wrangler.jsonc.vars` for server runtime (better-auth, payments).

```bash
DEPLOYED_URL=<from Phase 6 output>
CURRENT_URL=$(grep "^NEXT_PUBLIC_APP_URL=" .env.production | cut -d= -f2-)
```

If they differ:

1. Edit `.env.production` — set `NEXT_PUBLIC_APP_URL=$DEPLOYED_URL`
2. Re-run `pnpm run deploy` (no new confirmation — this is part of the same deploy event)
3. Narrate: "Baked the real URL into the client bundle and redeployed."

If `$DEPLOYED_URL == $CURRENT_URL`, skip — the placeholder happened to match.

## Phase 8: Verify (auto, smoke test)

```bash
URL="<deployed url>"
curl -sS --noproxy '*' -o /tmp/cf-home.html -w "/  HTTP=%{http_code} TIME=%{time_total}s SIZE=%{size_download}\n" "$URL/"
curl -sS --noproxy '*' -o /tmp/cf-api.html  -w "/api  HTTP=%{http_code}\n" "$URL/api/config/public"
```

If both 200, report success with the live URL highlighted.

Suggest `npx wrangler tail` for live logs (do NOT run as a Monitor — just print the command).

If any 500, capture from `wrangler tail` (a quick one-shot, not persistent) and surface the first error to the user.

## Phase 9: Set up first super_admin (interactive — Interruption #3, optional)

**Skip the prompt if:** Phase 2 found `ADMIN_COUNT > 0` AND no `--admin*` flag in `$ARGUMENTS`. Narrate "Admin already assigned, skipping". The user can still grant admin to an additional user via `/deploy-cloudflare --admin-email=X --admin-password=Y` or `--admin=X`.

**Non-interactive flag modes:**
- `--admin-email=X --admin-password=Y` → **create-account mode (9.A)**: agent creates user + account + role assignment in one shot, no prompt
- `--admin=X` → **promote-existing mode (9.B)**: agent assigns `super_admin` to an existing user with that email (user must have signed up first)

**Otherwise (no flag, no admin yet)**, prompt:

> No `super_admin` exists yet. Reply with one of:
>
> **(1)** `admin@example.com YourPassword123` — agent creates the account directly (user table + hashed password + super_admin role). You can sign in immediately at `<URL>/sign-in`.
> ⚠️ Your password will be visible in this chat. Either rotate it after first login, or pick option (2) for OAuth-based signup.
>
> **(2)** `admin@example.com` (email only) — agent assigns `super_admin` to an **existing** user. Sign up first at `<URL>/sign-up` (email/password or OAuth), then reply with your email.
>
> **(3)** `skip` — assign later with `/deploy-cloudflare --admin-email=X --admin-password=Y` or `--admin=X`.

Parse the reply:
- **2 whitespace-separated tokens, second token doesn't look like an email** → mode 9.A (create with password)
- **1 token shaped like an email** → mode 9.B (promote existing)
- `skip` → no-op

### 9.A Create account directly (email + password)

The project's `scripts/init-rbac.ts` handles user creation + password hashing (via `better-auth/crypto`) + role assignment when given both flags. Reuse the same local-sqlite trick as Phase 4.5 — the local D1 already has RBAC roles from that phase, so init-rbac will skip the role seed and only add the admin user.

```bash
EMAIL="$1"           # never echoed to user beyond this point
PASS="$2"            # never echoed beyond this point
DB_NAME="<from wrangler.jsonc>"
LOCAL_D1=$(find .wrangler/state -name "*.sqlite" -path "*/d1/*" | head -1)

# 1. Re-run init-rbac with admin flags against the (already-seeded) local D1
DATABASE_PROVIDER=sqlite DATABASE_URL="file:$LOCAL_D1" \
  pnpm rbac:init --admin-email="$EMAIL" --admin-password="$PASS" 2>&1 | tail -10

# 2. Dump ONLY user + account rows (NOT user_role). Two gotchas:
#    a. sqlite3 `.dump` outputs CREATE then INSERTs in alphabetical table order
#       ("account" before "user"), which fails FK (account.user_id → user.id).
#       Emit user first, account second.
#    b. The user_role row's role_id UUID was generated locally and won't match
#       the remote D1's role.id (those came from the earlier Phase 4.5 seed run).
#       Skip user_role from the dump; insert it via JOIN in step 4 instead.
{
  sqlite3 "$LOCAL_D1" ".dump user" | grep -E "^INSERT INTO user "
  sqlite3 "$LOCAL_D1" ".dump account" | grep -E "^INSERT INTO account "
} | sed 's/^INSERT INTO/INSERT OR IGNORE INTO/' > /tmp/admin-seed.sql

# 3. Push user + account to remote D1
npx wrangler d1 execute "$DB_NAME" --remote --file=/tmp/admin-seed.sql --json

# 4. Insert user_role using a JOIN that resolves role.id on the remote.
#    user.id already matches between local and remote (same UUID emitted in step 2).
npx wrangler d1 execute "$DB_NAME" --remote --json --command="
INSERT OR IGNORE INTO user_role (id, user_id, role_id, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  u.id, r.id,
  unixepoch() * 1000,
  unixepoch() * 1000
FROM user u, role r
WHERE u.email = '$EMAIL' AND r.name = 'super_admin'
"

# 5. Verify
npx wrangler d1 execute "$DB_NAME" --remote --json --command="
SELECT u.email, r.name FROM user u
JOIN user_role ur ON ur.user_id = u.id
JOIN role r ON r.id = ur.role_id
WHERE u.email = '$EMAIL' AND r.name = 'super_admin'
"
```

If verify returns 1 row, narrate (do NOT echo the password): `✓ Admin <email> created and granted super_admin. Sign in at <URL>/sign-in.`

If verify returns 0 rows, surface the init-rbac stdout — likely the password was rejected (too short for better-auth's min length) or the user already existed with a different password (init-rbac won't overwrite).

### 9.B Promote existing user (email only)

The user signed up via the web first. Agent only needs to assign the role:

```bash
EMAIL="$1"
DB_NAME="<from wrangler.jsonc>"

npx wrangler d1 execute "$DB_NAME" --remote --command="
INSERT OR IGNORE INTO user_role (id, user_id, role_id, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  u.id,
  r.id,
  unixepoch() * 1000,
  unixepoch() * 1000
FROM user u, role r
WHERE u.email = '$EMAIL' AND r.name = 'super_admin'
"

# Verify (same as 9.A step 4)
```

If verify returns 0 rows → user hasn't signed up yet (or wrong email). Tell them:
> No user found with email `<email>`. Either sign up at `<URL>/sign-up` first and re-supply the email, or use option (1) above to have me create the account directly.

If verify returns 1 row → `✓ <email> is now super_admin. Visit <URL>/admin to manage.`

### Notes for both modes

- **Password handling:** in 9.A the password appears in the chat once (when user provides it). Agent never echoes it back, never includes it in narration or commit messages. It's stored hashed in D1 via better-auth/crypto. Agent should remind the user to rotate it on first login if they're security-conscious.
- **Idempotent:** both modes use `INSERT OR IGNORE`. Re-running with the same email is a no-op.
- `scripts/assign-role.ts` is not used here because it can't talk to remote D1.

## Force flags (override idempotency)

For maintenance scenarios the user can opt out of the auto-skip:

| Flag | Effect |
|---|---|
| `/deploy-cloudflare` (no flags) | Idempotent re-run. Only Phase 6 confirmation fires. Builds and deploys latest code. |
| `/deploy-cloudflare --preview` | Same as above but deploys to a preview Worker URL via `vinext deploy --preview`. |
| `/deploy-cloudflare --admin-email=X --admin-password=Y` | Phase 9.A create-account mode. Creates the user + account + super_admin role in one shot, no sign-up needed. |
| `/deploy-cloudflare --admin=email@x.com` | Phase 9.B promote-existing mode. Grants `super_admin` to an already-registered user. Use for OAuth users or for adding a second admin. |
| `/deploy-cloudflare --domain=app.example.com` | Switch the Worker to a custom domain (adds `routes` to `wrangler.jsonc`, sets `.env.production`, redeploys). Use `--domain=default` or `--domain=workers.dev` to revert to the workers.dev URL. |
| `/deploy-cloudflare --rotate-secrets` | Re-upload all secrets from `.env.local` (e.g. after rotating Stripe keys). |
| `/deploy-cloudflare --force-rbac` | Re-run Phase 4.5 even if `role` table is non-empty (e.g. after `init-rbac.ts` gained new default permissions). |

A bare `/deploy-cloudflare` is the answer to "再发布一下 / ship again" — detection in Phase 2 short-circuits unnecessary work; only the deploy confirmation prompt fires.

## Troubleshooting cheatsheet

| Symptom | Likely cause | Fix |
|---|---|---|
| `Error: D1 binding DB not found` | `wrangler.jsonc` `d1_databases` empty or wrong binding name | Phase 3.3 |
| `cloudflare:workers` module not found at build | Build env isn't Workers — `vite.config.ts` missing `cloudflare()` plugin in build mode | Check vite.config conditional |
| 500 on every page after deploy | AUTH_SECRET placeholder, or `DATABASE_PROVIDER` not `d1` in wrangler.jsonc.vars | Phase 5.1 / Phase 3.3 |
| `ERR_PNPM_CANNOT_DEPLOY: A deploy is only possible from inside a workspace` | Ran `pnpm deploy` (pnpm intercepts) | Use `pnpm run deploy` |
| Bundle > 10 MB | Heavy deps at top of route handlers | Use dynamic `await import(...)` or remove unused packages |
| `Identifier 'module' has already been declared` during build | Vite CJS-interop collision with Node-native dep | Add package to `ssr.external` in `vite.config.ts` (already done for `mysql2/postgres/@libsql/client/iconv-lite`) |
| Stripe webhook 400 / signature mismatch | `STRIPE_SIGNING_SECRET` value wrong (test vs live env) | `wrangler secret put STRIPE_SIGNING_SECRET` with value from Stripe dashboard for the right environment |
| drizzle-kit "Interactive prompts require a TTY" | Schema diff needs column-conflict resolution | User runs `pnpm db:generate` once in their terminal answering prompts |
| Phase 4.5 fails with `sqlite3: command not found` | sqlite3 CLI missing | macOS: `brew install sqlite` · Debian/Ubuntu: `sudo apt-get install sqlite3` |
| Phase 9.B verification returns 0 rows | User hasn't signed up yet (or wrong email) | Either ask user to sign up first and re-supply the email, or switch to Phase 9.A by re-running with `--admin-email=X --admin-password=Y` |
| Phase 9.A init-rbac says "User not found" without creating | Password didn't pass better-auth validation (typically too short; check `min 8 chars`) | Pick a stronger password and re-run with `--admin-email=X --admin-password=Y` |
| Phase 9.A push fails with `FOREIGN KEY constraint failed` on `account` | sqlite3 `.dump user account` emits account-INSERTs before user-INSERTs (alphabetical), violating account.user_id FK | Emit `.dump user` and `.dump account` separately so user inserts first (already handled in the updated 9.A code) |
| Phase 9.A push fails with FK on `user_role` | Local sqlite's `role.id` UUID doesn't match remote D1's (each `init-rbac` run generates fresh UUIDs) | Don't dump user_role from local; insert via JOIN against remote `role` (already handled in the updated 9.A code) |
| `/admin` route returns 403 after Phase 9 | RBAC cache in user session — sign out and back in | Or wait for session expiry; auth re-issues claims |
| Deploy fails with `Could not route to ... not a zone in your account` | Custom domain isn't a Cloudflare zone | Add `example.com` to Cloudflare (Websites → Add site → update nameservers), or revert to default: `/deploy-cloudflare --domain=default` |
| Custom domain returns CF error 522 / 1014 after deploy | DNS propagation pending; CF auto-creates the record on first deploy but it may take a minute | Wait ~30s and retry. If still failing, check Cloudflare dashboard → Workers → Routes for the binding |
| Sign-up endpoint returns 403 `{"message":"Invalid origin"}` (from `curl` without `Sec-Fetch-*` headers) | better-auth's `trustedOrigins` is empty because server-side `process.env.NEXT_PUBLIC_APP_URL` is undefined — `.env.production` only inlines for the client bundle | Add `NEXT_PUBLIC_APP_URL` (and `NEXT_PUBLIC_APP_NAME`) to `wrangler.jsonc.vars`, then redeploy (already handled in updated Phase 5.5) |
| Sign-in/sign-up returns 403 `Invalid origin` from a browser BUT `curl` without `Sec-Fetch-Site` returns 200 | `.env.local` (with `NEXT_PUBLIC_APP_URL=http://localhost:...`) overrode `.env.production` during the build, so `envConfigs.app_url` was baked as `http://localhost:...`. Browsers send `Sec-Fetch-Site: same-origin` which triggers better-auth's CSRF/trustedOrigins check; raw curl doesn't, so curl works while browsers don't. | Source `.env.production` BEFORE the build: change `package.json` `scripts.deploy` to `sh -c 'set -a && [ -f .env.production ] && . ./.env.production; set +a && exec npx vinext deploy'`. Verify after redeploy by `grep app_url: dist/server/index.js` — should show the prod URL, not `http://localhost:...`. (See Phase 0.4 / Phase 6.) |
| `pnpm dev` errors with `Cannot find module 'cloudflare:workers' imported from src/core/db/d1.ts` | Phase 3.4 wired `getD1Binding` with `import { env } from 'cloudflare:workers'` (static import). Vite parses this at module load even though `createD1Db()` is never called when `DATABASE_PROVIDER=sqlite`. `cloudflare:workers` only resolves in workerd. | Add the stub + `resolve.alias` (see Phase 3.4 "Critical companion step"). One-liner check: `test -f src/core/db/cloudflare-workers-stub.ts && grep -q 'cloudflare:workers' vite.config.ts && echo OK`. |
| `pnpm dev` says "Another vinext dev server is already running" but the listed PID is actually a stale `next dev` from before the vinext migration | Old Next.js dev process never exited; `lsof -nP -iTCP -sTCP:LISTEN` shows it bound to 3000 or 3001 | `kill -9 <pid>` (or `pkill -9 -f "next dev"` to nuke any old next-server processes), then re-run `pnpm dev` |
| Runtime throws "This DB driver was stubbed out of the Cloudflare Workers build" | `wrangler.jsonc` `vars.DATABASE_PROVIDER` was changed AFTER the last build (vite.config.ts bakes the driver choice at build time) | Rebuild + redeploy (`pnpm run deploy`) so the bundle matches the provider |
| Postgres mode: every query fails with connection errors but `wrangler hyperdrive create` succeeded | `hyperdrive` binding missing from `wrangler.jsonc`, or binding name ≠ `HYPERDRIVE` | `src/core/db/postgres.ts` expects binding name exactly `HYPERDRIVE`; fix wrangler.jsonc and redeploy |
| Postgres mode: intermittent `Cannot perform I/O on behalf of a different request` | A postgres client got cached across requests (e.g. someone re-added a module-level cache for TCP drivers) | `src/core/db/index.ts` deliberately skips the singleton cache for postgres/mysql on Workers — restore that behavior |
| `wrangler hyperdrive create` fails with connection error | Postgres unreachable from Cloudflare: IP allowlist, no TLS, or blocked port | Allow Cloudflare egress / enable TLS on the DB; for Neon/Supabase use the direct (non-pooler) connection string |

## What this skill never does

- Run the final `pnpm run deploy` without explicit user `yes` (the redeploy in Phase 7 is part of the same already-confirmed deploy event)
- Echo secret values to the user (generates with openssl, pipes from .env.local, prints names only)
- Write secret values into `wrangler.jsonc.vars` (vars are public)
- Run against upstream `shipany-next` — that repo targets Node/Docker/Vercel, not Workers
- Make the user copy-paste any wrangler/openssl/db command for routine setup — those are agent-executed
