---
name: sync-upstream
description: Pull the latest ShipAny Next template changes from the upstream repo (git@github.com:shipany-ai/shipany-next, main branch) into this Cloudflare-native repo, preferring this repo's Vite/Cloudflare adaptations when they conflict. Use when the user asks to "update from upstream", "sync the template", "拉取上游更新", "更新模板", or wants the newest ShipAny features in shipany-vinext.
---

# Sync Upstream (shipany-vinext ← shipany-next)

Merge the latest features from `shipany-ai/shipany-next` (the Node/Docker/Vercel
edition, `main` branch) into this Cloudflare-native repo. This repo's Vite/Workers
layer always wins on conflict — upstream provides business features; this repo
provides the build + deploy substrate.

## Ownership map (decides every conflict)

| Path | Owner | On conflict |
|---|---|---|
| `vite.config.ts`, `wrangler*`, `.env.production.example` | **this repo** | keep local |
| `package.json` `scripts` (vinext dev/build/deploy) + vite/vinext deps | **this repo** | keep local scripts/deps, take upstream's NEW business deps |
| `src/core/db/` Workers wiring (`cloudflare:workers` imports, `d1.ts`, `postgres.ts` Hyperdrive block, `stubs/`, `cloudflare-workers-stub.ts`) | **this repo** | keep local |
| `.claude/skills/deploy-cloudflare/`, this skill | **this repo** | keep local |
| `next.config.ts`, Next-specific entry adaptations | **this repo** | keep local |
| `src/modules/`, `src/lib/`, `src/core/` (non-db-wiring), `src/config/` | **upstream** | take upstream |
| `src/app/`, `src/blocks/`, `src/components/`, locale messages | **upstream** | take upstream, then re-verify Vite compat (see step 5) |
| `AGENTS.md`, `README.md` | **this repo** | keep local, port new sections manually |

## Workflow

### 1. Preflight

```bash
git status --porcelain       # must be empty — ask the user to commit/stash first
git remote get-url upstream 2>/dev/null \
  || git remote add upstream git@github.com:shipany-ai/shipany-next.git
git fetch upstream main
```

If the SSH fetch fails (no key configured), switch to HTTPS and retry:

```bash
git remote set-url upstream https://github.com/shipany-ai/shipany-next.git
git fetch upstream main
```

### 2. Preview what's incoming

```bash
git log --oneline HEAD..upstream/main
```

- Empty → already up to date; report and stop.
- Otherwise show the user the incoming commits before merging.

### 3. Merge, preferring the ownership map

Run a plain merge first so conflicts are *visible* (don't use `-X ours` blindly —
it silently discards upstream hunks with no record of where):

```bash
git merge upstream/main --no-edit
```

On conflict, resolve each path per the ownership map:

```bash
git diff --name-only --diff-filter=U          # the conflict list — save it
git checkout --ours  -- <paths this repo owns>
git checkout --theirs -- <paths upstream owns>
git rm <file>                                 # for files deleted locally ("deleted by us")
git add -A && git commit --no-edit
```

Special cases:
- **`pnpm-lock.yaml` conflicts** — don't hand-resolve: take either side, then let
  `pnpm install` regenerate it in step 4.
- **`package.json` conflicts** — hand-merge: keep this repo's `name` + `scripts` +
  vite/vinext/wrangler deps, add upstream's new business deps.
- **Translation JSON conflicts** — take upstream, but re-check any keys this repo
  customized.

### 4. Post-merge integration

```bash
pnpm install                 # lockfile / new dependencies
```

- **Schema templates changed?** (`git diff HEAD@{1} -- src/config/db/schema.*.ts`)
  `schema.ts` is the user's gitignored working copy — do NOT run `db:setup` over
  it. Port new columns/tables into `schema.ts` manually, then `pnpm db:push` (dev)
  or generate a migration.
- **New env vars?** Check `.env.example` diff; tell the user what to add to
  `.env.development` and (if server-side) `wrangler.jsonc` vars/secrets.

### 5. Vite-compat pass over incoming app code

Upstream code is written for Next.js/webpack. Scan the incoming diff for patterns
that break under Vite/workerd and adapt them (this is the ONE place manual porting
is expected):

```bash
git diff HEAD@{1} --name-only -- src/app src/blocks src/components | head -50
```

- `require(...)` / dynamic `fs` access of bundled assets → `import.meta.glob`
- MDX usage assuming `providerImportSource` → pass `components` prop directly
- Node-only APIs in request paths (fs, child_process) → Workers-compatible
  alternative or move behind a provider
- New DB driver usage → confirm vite.config.ts driver-stub list still matches

```bash
pnpm build                   # Workers bundle must build
pnpm dev                     # quick smoke: homepage + one DB-backed API
```

If the build fails because a kept-local file references a changed upstream API,
fix forward (adapt the local file) — do not re-introduce the upstream version
wholesale.

### 6. Report

- Incoming commits (count + notable features)
- Conflicts and how each was resolved (per ownership map)
- Vite-compat adaptations made in step 5
- Schema/env follow-ups the user must do
- Build status

Do NOT push — let the user review the merge first.

## Rules

1. **The ownership map decides conflicts** — never let upstream overwrite the
   Vite/Cloudflare layer, never keep stale local copies of upstream business logic.
2. **Conflicts must be visible.** Plain merge + per-file `--ours`/`--theirs`,
   never `-X ours`.
3. **Never touch `schema.ts` automatically** — it's the user's working copy.
4. **Never push commits back to upstream** — re-implement shared fixes there.
5. **`pnpm build` must pass** before declaring the sync done.
