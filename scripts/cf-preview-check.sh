#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== PitchPro Cloudflare preview check =="
ok=0; fail=0
check() { if eval "$2" >/dev/null 2>&1; then echo "  [ok] $1"; ok=$((ok+1)); else echo "  [--] $1"; fail=$((fail+1)); fi; }
check "wrangler.jsonc exists" "test -f wrangler.jsonc"
check "worker name pitchpro" "grep -q '\"name\": \"pitchpro\"' wrangler.jsonc"
check "route pitchpro.api2.ccwu.cc" "grep -q 'pitchpro.api2.ccwu.cc' wrangler.jsonc"
check "r2 pitchpro-assets" "grep -q 'pitchpro-assets' wrangler.jsonc"
check "docs/CLOUDFLARE_PREVIEW.md" "test -f docs/CLOUDFLARE_PREVIEW.md"
check "secrets checklist" "test -f docs/CLOUDFLARE_SECRETS_CHECKLIST.md"
if grep -q 'PENDING_CREATE_ON_XIE861861\|REPLACE_WITH_OUTPUT' wrangler.jsonc; then
  echo "  [--] database_id still pending (need D1 create on xie861861)"
  fail=$((fail+1))
else
  echo "  [ok] database_id looks filled"
  ok=$((ok+1))
fi
echo "  .. wrangler whoami (must be xie861861 for provision; velapaw token is wrong account)"
npx wrangler whoami 2>&1 | head -n 25 || true
echo "== summary: ok=$ok pending_or_missing=$fail =="
exit 0
