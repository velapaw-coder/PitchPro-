# ShipAny vinext

**The Cloudflare-native edition of [ShipAny Next](https://github.com/shipany-ai/shipany-next)** — a headless SaaS engine for building AI-powered products with Claude Code. Pre-wired business logic (payments, credits, subscriptions, auth, RBAC, i18n, CMS) with minimal UI — you build your product pages on top, and deploy to **Cloudflare Workers** with one command.

Runs Next.js 15 on Vite via [vinext](https://www.npmjs.com/package/vinext) + `@cloudflare/vite-plugin`. Database: **D1** (zero infra, default) or **Postgres via Hyperdrive**. If you deploy to Node/Docker/Vercel instead, use upstream [shipany-next](https://github.com/shipany-ai/shipany-next).

## Quick Start

```bash
pnpm install
cp .env.example .env.development   # then fill in the values (AUTH_SECRET etc.)
pnpm db:push
pnpm rbac:init --admin-email=admin@example.com --admin-password=your-password
pnpm dev
```

> Local env lives in `.env.development` (gitignored). It is loaded by both `next dev`
> and the `db:*` scripts. Only `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`,
> `DATABASE_PROVIDER`, `DATABASE_URL`, and `AUTH_SECRET` are required to boot.

## Features

- **Auth** — Email/password + Google/GitHub OAuth via better-auth
- **Payment** — Stripe, PayPal, Alipay, WeChat Pay (checkout, subscriptions, webhooks)
- **Credits** — FIFO consumption, expiration, auto-grant on signup
- **RBAC** — Roles, permissions, wildcard matching, admin panel management
- **API Keys** — CRUD + validation
- **Invite Codes** — Trial activation, batch generation, usage tracking
- **CMS** — Categories and posts with full CRUD
- **Image Upload** — Drop / paste / click uploader; uses S3/R2 if configured, falls back to inline base64 (size-capped) stored in DB
- **i18n** — English + Chinese via next-intl, locale-aware routing
- **Admin Panel** — Full-featured admin with grouped sidebar navigation:
  - **RBAC** — Users (role assignment), Roles (permission management), Permissions
  - **Content** — Categories, Posts (with status tabs, category selector)
  - **Billing** — Payments, Subscriptions, Credits (with type/status tabs)
  - **Settings** — Collapsible config groups (General, Auth, Payment, Email, Storage, AI)
  - System switcher dropdown (Admin / Dashboard / Landing)
- **Dashboard** — Client-side rendered with shadcn sidebar
- **MDX Pages** — Privacy policy, terms of service, extensible via skill
- **Database** — SQLite (dev) / PostgreSQL / MySQL via Drizzle ORM
- **All code self-contained** — no external packages for business logic

## Tech Stack

- Next.js 15 (App Router, React 19, TypeScript) running on Vite via vinext
- Cloudflare Workers runtime (`@cloudflare/vite-plugin`, wrangler)
- shadcn/ui v4 (Base Nova style, Tailwind CSS 4)
- better-auth + Drizzle ORM (D1 / Postgres+Hyperdrive in production, sqlite/postgres/mysql in local dev)
- next-intl for i18n

## Deploy to Cloudflare

```
/deploy-cloudflare
```

One Claude Code command handles everything: wrangler login, D1 create (or `wrangler hyperdrive create` for Postgres), schema migrations, RBAC seed, secrets upload, deploy, URL fixup, and admin account setup. Idempotent — re-run it any time to ship the latest code. See `.claude/skills/deploy-cloudflare/SKILL.md`.

## Relationship to shipany-next (upstream)

New features are developed in [shipany-next](https://github.com/shipany-ai/shipany-next) and pulled into this repo with the `/sync-upstream` skill. This repo owns the Vite/Cloudflare layer (`vite.config.ts`, `wrangler*`, Workers DB wiring, deploy skill); on sync conflicts in those paths, this repo's version wins. Never push this repo's commits back upstream.

## Project Structure

```
src/
├── core/           # Infrastructure (db, auth, payment, email, storage, ai, i18n)
├── modules/        # Business logic (payment, credits, subscriptions, apikeys, rbac, posts, taxonomy)
├── config/         # Environment, DB schema, locale translations
├── app/
│   ├── [locale]/   # Pages (landing, auth, dashboard, admin, legal)
│   └── api/        # REST endpoints
├── components/     # Shared UI (app-layout, app-sidebar, data-table, user-menu, shadcn)
└── lib/            # Utilities (hash, resp, cookie, cache, rate-limit)
```

## Admin Panel

The admin panel (`/admin`) provides a complete back-office interface:

| Section  | Pages                            | Features                                          |
| -------- | -------------------------------- | ------------------------------------------------- |
| Overview | Dashboard                        | Stats overview                                    |
| RBAC     | Users, Roles, Permissions        | Full CRUD, role assignment, permission management |
| Content  | Categories, Posts                | Full CRUD, status tabs, category selector         |
| Billing  | Payments, Subscriptions, Credits | Server-side pagination, type/status tabs, search  |
| Settings | System config                    | Collapsible groups, tabbed sections, all i18n     |

All admin pages include:

- Server-side paginated data tables with search
- Dialog-based create/edit/delete forms
- Complete English and Chinese translations

## Commands

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `pnpm dev`         | Start dev server                                 |
| `pnpm build`       | Production build                                 |
| `pnpm db:setup`    | Copy schema template for chosen database         |
| `pnpm db:push`     | Push schema to database (dev)                    |
| `pnpm db:generate` | Generate migration SQL (production)              |
| `pnpm db:migrate`  | Run migrations (production)                      |
| `pnpm db:studio`   | Drizzle Studio GUI                               |
| `pnpm rbac:init`   | Create roles + permissions + optional admin user |
| `pnpm rbac:assign` | Assign role to user                              |

## Claude Code Skills

| Skill                | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `/quick-start`       | Build a complete SaaS from a brief or reference URL      |
| `/new-module`        | Create a backend module (service + API)                  |
| `/new-page`          | Create a dashboard page (client component + nav)         |
| `/new-static-page`   | Create an MDX content page (legal, about, FAQ)           |
| `/deploy-cloudflare` | Deploy to Cloudflare Workers (D1 or Postgres+Hyperdrive) |
| `/sync-upstream`     | Pull the latest features from shipany-next               |

## Environment Variables

```env
# Required
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=My App
NEXT_PUBLIC_APP_LOGO=/logo.png
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:data/local.db
AUTH_SECRET=generate-with-openssl-rand-base64-32

# Optional
NEXT_PUBLIC_DEFAULT_LOCALE=en
STRIPE_SECRET_KEY=
RESEND_API_KEY=
REPLICATE_API_TOKEN=

# Storage (optional — image upload falls back to inline base64 if unset)
STORAGE_ENDPOINT=
STORAGE_REGION=auto
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
STORAGE_BUCKET=
STORAGE_PUBLIC_DOMAIN=
INLINE_IMAGE_MAX_KB=2048
```

## License

This is proprietary software. See [LICENSE](./LICENSE) for the full license agreement.

**ShipAny** — [shipany.ai](https://shipany.ai)
