# PitchPro · Cloudflare 第二预发（P01）

> 账号 **p01030736399@gmail.com** · Account `beed820e3da33388b3806b0c26d4c24c`  
> **2026-10-28**：第三批 — 长图 QA 勾选、薄提案加厚横幅、聊方案「拿订单检查清单」；B2 视频/GHL、P1–P3、厚提案与 lk888 16:9·720p 仍在。

> 与 xie861861 预发（`wrangler.jsonc` / https://pitchpro.api2.ccwu.cc）**完全独立**，互不覆盖。

## 已上线（2026-10-24 Asia/Shanghai）

| 项 | 值 |
|---|---|
| Custom domain | **https://pitchpro.p01.ccwu.cc** （HTTP 200，title 呈品） |
| workers.dev | https://pitchpro.jizsrtzvu.workers.dev |
| Worker | `pitchpro` |
| Version | `594774a8-9ab9-419c-9910-3e0f96bb935d` |
| D1 name | `pitchpro` |
| D1 id | `0e3086a5-e9c3-470c-913e-aa77b534b1d8` |
| R2 | `pitchpro-assets`（binding `BUCKET`） |
| Zone | `p01.ccwu.cc` (`4bce61c3f298a4f802e12c9320b0d05d`) active |
| Config file | **`wrangler.p01.jsonc`**（勿写入 `wrangler.jsonc`） |
| AUTH_SECRET | 已 `wrangler secret put`（值在 `data/secrets/AUTH_SECRET_P01`，不入文档） |
| VIDEO_API_KEY / LK888_VIDEO_API_KEY | 已 `wrangler secret put`（值不入文档；D1 亦有 `video_api_key`） |
| Video provider | lk888 主线 `gk-video-3.5`（MC-GK1.5官转）+ 备用 `minimax-h3`（RQ2）· **16:9 · 720p** · 见 `VIDEO_LK888_ZH.md` |
| Schema | `drizzle/0000_small_cammi.sql` applied remote |
| RBAC | roles `super_admin` / `admin` / `editor` / `viewer` seeded remote |
| Super Admin | `admin@pitchpro.p01.local`（密码见 `data/secrets/ADMIN_PASSWORD_P01`，gitignored） |

## 与 xie 预发对照

| | xie861861 | P01 |
|---|---|---|
| URL | https://pitchpro.api2.ccwu.cc | https://pitchpro.p01.ccwu.cc |
| Account | `ed35f0e91f4c2e6979988d2dc4bdbd19` | `beed820e3da33388b3806b0c26d4c24c` |
| Config | `wrangler.jsonc` | `wrangler.p01.jsonc` |
| Token env | `CLOUDFLARE_API_TOKEN_XIE861861` | `CLOUDFLARE_API_TOKEN_P01` |
| D1 id | `fdba7007-63a0-4406-8e14-dabe25c6df99` | `0e3086a5-e9c3-470c-913e-aa77b534b1d8` |
| R2 | 未开通（API 10042） | **已开通** `pitchpro-assets` |

部署 P01 时曾短暂用 P01 内容覆盖 `wrangler.jsonc` / `.env.production`，部署后已恢复为 xie 的 `database_id` 与域名；xie 预发 spot-check 仍为 HTTP 200。

## 运维命令（只用 P01 token）

```bash
export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN_P01"
export CLOUDFLARE_ACCOUNT_ID=beed820e3da33388b3806b0c26d4c24c
cd /workspace/pitchpro

# 迁移
npx wrangler d1 migrations apply pitchpro --remote -c wrangler.p01.jsonc

# 重新部署：备份 → 用 wrangler.p01.jsonc 覆盖 wrangler.jsonc → deploy → 必须恢复备份
cp -a wrangler.jsonc /tmp/wrangler.jsonc.xie-backup
cp -a .env.production /tmp/env.production.xie-backup
cp wrangler.p01.jsonc wrangler.jsonc
# 临时把 .env.production 的 NEXT_PUBLIC_APP_URL 改为 https://pitchpro.p01.ccwu.cc
pnpm run deploy
cp -a /tmp/wrangler.jsonc.xie-backup wrangler.jsonc
cp -a /tmp/env.production.xie-backup .env.production
# 断言：wrangler.jsonc 仍含 fdba7007-63a0-4406-8e14-dabe25c6df99 与 pitchpro.api2.ccwu.cc
```

## 登录

1. 打开 https://pitchpro.p01.ccwu.cc/sign-in  
2. 邮箱 `admin@pitchpro.p01.local`  
3. 密码从本机 `data/secrets/ADMIN_PASSWORD_P01` 读取（勿提交 git）

## 备注

- vinext `deploy` 不支持 `--config`，故 P01 部署依赖临时 swap；务必恢复 xie 的 `wrangler.jsonc`。
- Token 权限需含 Workers / D1 / R2 / DNS（Zone `p01.ccwu.cc`）。

## 左聊 PDF 摘录（2026-10-28）

- 上传 PDF 时用 **unpdf**（Worker 兼容 pdf.js serverless build，需 `nodejs_compat`）**按页抽取前最多 20 页**（够用即停），写入 `enterprise_asset.textPreview`；≥12MB 先做字面量/hex 回退再尝试 pdf.js；失败再走 capped 回退。
- **抽取失败不阻断入库**：文件仍进企业资料库 + R2；`textPreview` 写清「已入库但抽取失败」中文原因（勿再让模型说「未同步到资料库」）。
- 扫描件/图片型 PDF：**无 OCR**；请用户贴要点或另传 txt。
- 聊方案时若摘录为空/占位，会从 R2 **重试抽取一次**（`【已重试抽取】` 标记防循环），再注入 `[附件摘录 · 文件名]`（合计约 5.5k 字）。
- 系统提示：有摘录可引用追问；仅抽取失败时说明已入库，引导压缩/拆分或另传 txt。

## 企业资料库上传

- 预发走 R2 binding `BUCKET` → 桶 `pitchpro-assets`（key 前缀 `enterprise-uploads/`）。
- 本地 `pnpm dev` 仍写 `data/enterprise-uploads/`。
- **单文件上限 25MB**（`next.config` `experimental.serverActions.bodySizeLimit` + `/api/pitchpro/assets`）。vinext 会把无 `Next-Action` 的 multipart POST 先当 progressive server action，默认 1MB 会回纯文本 `Payload Too Large`（前端 JSON 解析失败）；已抬到 25MB。更大文件请压缩／拆分；真·直传 R2 需另开 S3 预签名。
- 若 UI 仍报 `operation not permitted`，多半是旧包还在写本地盘，重新 `pnpm run deploy`（按上文 swap `wrangler.p01.jsonc`）即可。
