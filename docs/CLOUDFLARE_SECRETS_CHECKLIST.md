# PitchPro · Cloudflare secrets checklist

Account: **xie861861@gmail.com** (`ed35f0e91f4c2e6979988d2dc4bdbd19`)  
Preview URL: **https://pitchpro.api2.ccwu.cc**  
Do **not** paste secret values into chat. Generate locally and `wrangler secret put`.

## Required before first live deploy

| Secret | How |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` → `echo -n '…' \| npx wrangler secret put AUTH_SECRET` |
| (optional) `AUTH_URL` / trusted origins | Prefer `vars.NEXT_PUBLIC_APP_URL` already set to `https://pitchpro.api2.ccwu.cc` |

## Optional (features)

| Secret / var | Notes |
|---|---|
| `GHL_API_KEY` / `GHL_LOCATION_ID` | Live GHL; empty → Mock |
| `GHL_PIPELINE_ID` / `GHL_PIPELINE_STAGE_ID` | Optional opportunity |
| `STORAGE_ENDPOINT` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` / `STORAGE_BUCKET` / `STORAGE_PUBLIC_DOMAIN` | If app uses S3-compat API against R2 instead of Workers binding alone; bucket name `pitchpro-assets` |
| Payment / email keys | Only if enabling those modules |

## After secrets

1. `npx wrangler d1 migrations apply pitchpro --remote` (or project migrate path)
2. `pnpm rbac:init` against remote D1 (see deploy-cloudflare skill dance)
3. `pnpm run deploy` (sources `.env.production`; **confirm** — irreversible)
4. Custom domain: wrangler `routes` already set; zone `api2.ccwu.cc` must be on **this** CF account

## Staged on box (not uploaded)

- `data/secrets/AUTH_SECRET` — generated locally, gitignored. Put with:

```bash
# Only after wrangler whoami shows xie861861@gmail.com
cd /workspace/pitchpro
unset CLOUDFLARE_API_TOKEN   # if it still points at velapaw
export CLOUDFLARE_API_TOKEN='…xie861861 token…'   # or wrangler login as xie861861
tr -d '\n' < data/secrets/AUTH_SECRET | npx wrangler secret put AUTH_SECRET
```

Never paste the secret value into chat.

## After MCP/API token has D1+R2+Workers

```bash
bash scripts/cf-provision-pitchpro.sh   # creates D1 pitchpro + R2 pitchpro-assets, patches database_id
# then migrations / rbac / pnpm run deploy (confirm)
```

## Status

- `AUTH_SECRET` 已上传到 Worker `pitchpro`（2026-10-24）。
- R2 / STORAGE_* 仍可选，待 R2 开通。
