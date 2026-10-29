# PitchPro · Cloudflare 预发清单

> 账号 **xie861861@gmail.com** · Account `ed35f0e91f4c2e6979988d2dc4bdbd19`

## 已上线（2026-10-24 Asia/Shanghai）

| 项 | 值 |
|---|---|
| Custom domain | **https://pitchpro.api2.ccwu.cc** （HTTP 200，title 呈品 PitchPro） |
| workers.dev | https://pitchpro.xie861861.workers.dev （当前返回 500；以自定义域为准） |
| Worker | `pitchpro` |
| Version | `1dfb81de-f8b9-4bf1-9fcd-e2809b5d63c0`（deploy 时） |
| D1 name | `pitchpro` |
| D1 id | `fdba7007-63a0-4406-8e14-dabe25c6df99` |
| Zone | `api2.ccwu.cc` (`13e54d55758bcea467291b02a2f1563a`) active on this account |
| DNS | `pitchpro.api2.ccwu.cc` → Cloudflare anycast A（proxied via custom_domain） |
| AUTH_SECRET | 已 `wrangler secret put`（值不在文档） |
| Schema | `drizzle/0000_small_cammi.sql` applied remote |
| RBAC | roles `super_admin` / `admin` / `editor` / `viewer` seeded remote |

## R2（未完成）

账号尚未开通 R2（API `10042 Please enable R2 through the Cloudflare Dashboard`）。  
`wrangler.jsonc` 中 `r2_buckets` 已注释。开通后：

```bash
export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN_XIE861861"
npx wrangler r2 bucket create pitchpro-assets
# 取消注释 wrangler.jsonc r2_buckets，再 pnpm run deploy
```

## 仍待 Hailan

1. Dashboard → R2 → Get started（启用后建 `pitchpro-assets`）
2. 首次管理员：在线上注册或本地对 remote 做 admin（skill Phase 9）；本地曾用 `admin@pitchpro.local` 仅适用于 sqlite
3. 可选 GHL Live：`wrangler secret put GHL_API_KEY` 等
4. workers.dev 500：若需要备用入口再查；主入口用自定义域

## 运维命令（只用 xie token）

```bash
export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN_XIE861861"
export CLOUDFLARE_ACCOUNT_ID=ed35f0e91f4c2e6979988d2dc4bdbd19
cd /workspace/pitchpro
pnpm run deploy
npx wrangler d1 migrations apply pitchpro --remote
```

勿使用 velapaw 的 `CLOUDFLARE_API_TOKEN`。
