---
name: launch-audit
description: "Whole-project audit-and-fix passes for a ShipAny project across five launch-readiness dimensions: responsive/mobile, light/dark theme, SEO, performance (Lighthouse), and security. Use when the user wants to sweep the WHOLE project (not one component) on one of these axes, or run a final check before deploying. Triggers on: '整体处理一下响应式 / 手机端 / 移动端适配', '整体处理 light/dark 主题 / 暗黑模式样式', '整体修一下 seo / 每个页面 seo 友好', '整体修性能 / Lighthouse 评分 / Core Web Vitals', '整体排查安全问题 / 上线前安全 / 找漏洞', plus EN equivalents: 'make the whole site mobile-friendly', 'fix dark mode everywhere', 'audit SEO across all pages', 'improve Lighthouse scores', 'security sweep before deploy', 'pre-launch check'."
argument-hint: "[responsive|theme|seo|perf|security|all] — which dimension to audit & fix (omit to infer from the request or run all)"
user-invocable: true
---

# Launch Audit — $ARGUMENTS

A **whole-project**, audit-then-fix pass for a ShipAny project. Each dimension is a
self-contained checklist tuned to this codebase (blocks/components split, oklch theme
tokens, next-intl i18n, `sitemap.ts`/`robots.ts`, RBAC API routes). Run one dimension or
all five.

## When to use (timing)

- **Per-dimension, on demand** — the user asks to sweep the whole project on one axis
  ("整体处理一下响应式", "确保暗黑模式正常", "每个页面 seo 友好", "Lighthouse 评分要高",
  "排查一遍安全问题"). Infer the dimension from the phrasing.
- **Pre-launch gate** — before a production deploy, run `all` five in order. This is the
  natural final step after the build works and content is in place.
- **Not for a single component** — if the user is editing one block/page, just fix it
  inline. This skill is for the *cross-cutting sweep* ("整体/全站/每个页面").

If `$ARGUMENTS` doesn't name a dimension, infer it from the user's message; if it's a
generic "check everything before launch", run **all** in the order below (cheap → expensive,
security last as the deploy gate).

## How each pass works

For every dimension: **(1) inventory** the surface (which pages/blocks/components), **(2)
audit** against the checklist, **(3) fix** the real issues, **(4) verify** with the listed
command/tool, **(5) report** what changed and what was already fine. Always finish with
`pnpm build` passing. Prefer editing `src/blocks/*` and `src/components/*`; never hand-edit
`src/components/ui/*` (use `npx shadcn add`).

---

## 1. responsive — mobile & breakpoints

**Surface:** every block in `src/blocks/*`, marketing chrome (`site-header`,
`site-footer`), `app-sidebar`/`app-layout`, dashboard pages, dialogs/sheets.

**Audit:**
- Test at **390px** (mobile), **768px** (tablet), **1440px** (desktop). Use the
  `webapp-testing` / `agent-browser` skill to screenshot, or Chrome DevTools.
- Horizontal overflow (`overflow-x`): long unbroken strings, fixed `w-[...]` px widths,
  wide tables/grids not switching to a stacked layout, images without `max-w-full`.
- Tap targets ≥ 40px; nav collapses to a mobile menu (`site-header`); no hover-only actions.
- Grids: `grid-cols-3` etc. should degrade (`grid-cols-1 md:grid-cols-3`). Hero/feature
  text sizes use responsive steps (`text-3xl md:text-5xl`).
- Sidebar/sheets: `AppSidebar` collapses behind `SidebarTrigger` on small screens.
- Spacing: section padding scales (`py-12 md:py-24`), not fixed huge values on mobile.

**Fix:** add the missing responsive Tailwind variants; switch fixed widths to fluid
(`w-full max-w-*`); make tables horizontally scrollable (`overflow-x-auto`) or stack.

**Verify:** screenshots at 390/768/1440 with no overflow; `pnpm build`.

---

## 2. theme — light / dark visual correctness

**Surface:** `src/app/globals.css` (oklch CSS variables under `:root` and `.dark`), every
block/component, `next-themes` `ThemeProvider`.

**Audit:**
- **Hardcoded colors are the #1 dark-mode bug.** Grep for `bg-white`, `text-black`,
  `bg-black`, `text-white`, `bg-gray-*`, `border-gray-*`, raw `#hex`, `bg-[...]` in
  `src/blocks` + `src/components`. Replace with semantic tokens: `bg-background`,
  `text-foreground`, `bg-card`, `bg-muted`, `text-muted-foreground`, `border-border`,
  `bg-primary`/`text-primary-foreground`, `ring-ring`.
- Both `:root` and `.dark` define every token used; contrast is legible in dark
  (text vs. background, muted text, borders, disabled states).
- Images/illustrations with baked-in white backgrounds; SVG `fill="#000"` that should be
  `currentColor`; gradients/overlays that vanish in dark.
- Shadows (often invisible in dark — prefer borders), focus rings, hover states.
- Theme toggle works and persists; no flash of wrong theme (`suppressHydrationWarning` on
  `<html>`).

**Fix:** swap hardcoded utilities for tokens; add/adjust `.dark` token values in
`globals.css`; make decorative SVGs use `currentColor`.

**Verify:** load each page in light AND dark (toggle), screenshot both; `pnpm build`.

---

## 3. seo — per-page SEO friendliness

**Surface:** `src/app/layout.tsx` (root metadata) + `src/app/[locale]/layout.tsx`, each
page's `generateMetadata`/`metadata`, `src/app/sitemap.ts`, `src/app/robots.ts`, MDX/static
pages, i18n messages.

**Audit (per page):**
- Unique `title` + `description` (root has a `template`; pages override). No duplicate or
  empty titles. Title length ~50–60 chars, description ~120–160.
- `metadataBase` set; canonical URLs; `openGraph` (title/description/image/url) and
  `twitter` card present. OG image resolves (it's `/logo.svg` by default — for rich social
  cards a raster/`opengraph-image` is better).
- **i18n:** `alternates.languages` (hreflang) for each locale; locale-correct `<html lang>`.
- One `<h1>` per page, sane heading hierarchy; descriptive `alt` on meaningful images;
  links have text.
- `sitemap.ts` includes all public routes + blog/MDX with hreflang; `robots.ts` blocks
  `/admin`, `/settings`, `/api` and points to the sitemap.
- Structured data (JSON-LD) for org/product/article where relevant.
- No `noindex` left on public pages; no broken internal links.

For a deep crawl-style report, the **seo-audit** skill complements this. Use the
**schema-markup** approach for JSON-LD if adding structured data.

**Fix:** add/repair `generateMetadata`, hreflang alternates, sitemap entries, headings,
alt text, JSON-LD.

**Verify:** `pnpm build`; check `/sitemap.xml` + `/robots.txt`; view-source a couple of
pages for `<title>`/`<meta>`/`<link rel="alternate">`.

---

## 4. perf — performance & Lighthouse / Core Web Vitals

**Surface:** images, fonts, the landing page and heaviest routes, bundle size, data
fetching.

**Audit:**
- **Images:** use `next/image` with explicit `width`/`height` (or `fill` + sized parent) to
  avoid CLS; modern formats; `priority` only on the LCP image; lazy-load below the fold.
- **Fonts:** `next/font` (already used) with `display: swap`; preload only what's needed;
  avoid layout shift from late fonts.
- **Rendering:** landing/marketing pages stay SSG/ISR (no accidental `dynamic`); avoid
  `getLocale()` in a root `app/layout.tsx` (forces dynamic — see AGENTS.md). Heavy client
  components are `dynamic()`-imported / below-the-fold.
- **JS weight:** check the build output's largest chunks; tree-shake; don't pull a big lib
  into the landing bundle; defer analytics.
- **CWV targets:** LCP < 2.5s, CLS < 0.1, INP < 200ms.

Drive the actual measurement with the **web-perf** skill (Chrome DevTools MCP) or run
Lighthouse in the browser. Fix what the trace flags (render-blocking, long tasks, oversized
images, no caching headers).

**Fix:** convert `<img>`→`next/image`, add dimensions, set `priority`/lazy correctly,
`dynamic()` heavy widgets, trim bundles, keep marketing pages static.

**Verify:** re-run Lighthouse/web-perf; confirm scores improved and CWV are green;
`pnpm build` (watch chunk sizes).

---

## 5. security — pre-deploy vulnerability sweep

**Surface:** the whole diff/project — API routes (`src/app/api/*`), module services, auth &
RBAC, env handling, user input, file uploads.

**Audit:** run the project's **security-scan** skill (secrets, injection/XSS, auth/logic
flaws, `.gitignore`/`.dockerignore` gaps) AND review beyond the diff for launch:
- Every API route checks auth (`getSession`) and the right permission (`hasPermission`)
  before acting; no admin action reachable without `admin.*`.
- Server-trusts-client checks on money/credits/state (payment, credits, subscriptions) —
  amounts/ownership validated server-side, webhooks signature-verified.
- No secrets in client bundles or committed env; provider keys come from admin config/env,
  not hardcoded. `CONFIG_ENCRYPTION_KEY` set for production.
- Input validation on all writes; parameterized DB queries (Drizzle — no string-built SQL);
  output encoding (no `dangerouslySetInnerHTML` with user data).
- Open-redirect guards on auth `callbackUrl` (must be same-site `/…`); upload type/size
  limits; rate limiting on sensitive endpoints.
- `robots.ts` + middleware don't expose `/admin`/`/api`; error responses don't leak stack
  traces/secrets.

For a deeper pass, the **security-review** skill reviews the branch.

**Fix:** add the missing auth/permission/validation guards; remove leaked secrets (and
**rotate** any that were ever committed); tighten redirects/uploads.

**Verify:** `security-scan` clean (no HIGH); `pnpm build`. HIGH findings block deploy.

---

## Output

For each dimension run, end with a short report:

```
| 维度 | 检查范围 | 发现的问题 | 已修复 | 仍需关注 |
```

Then state `pnpm build` passes. For an `all` run, do them in order (responsive → theme →
seo → perf → security) and give one combined report; treat unresolved **security HIGH** as a
launch blocker.
