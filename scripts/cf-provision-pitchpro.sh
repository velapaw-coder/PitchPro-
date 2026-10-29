#!/usr/bin/env bash
# Create PitchPro D1 + R2 on the *current* wrangler identity, then patch wrangler.jsonc.
# MUST run only when `npx wrangler whoami` shows xie861861@gmail.com
# (account id ed35f0e91f4c2e6979988d2dc4bdbd19). Do NOT run under velapaw token.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== whoami =="
WHO=$(npx wrangler whoami 2>&1 || true)
echo "$WHO"
echo "$WHO" | grep -qi 'xie861861@gmail.com' || {
  echo "ABORT: wrangler is not authenticated as xie861861@gmail.com"
  echo "Unset CLOUDFLARE_API_TOKEN if it points at another account, or reconnect MCP with D1+R2+Workers scopes."
  exit 1
}

D1_NAME=pitchpro
R2_NAME=pitchpro-assets

echo "== create D1 $D1_NAME (ok if exists) =="
CREATE_OUT=$(npx wrangler d1 create "$D1_NAME" 2>&1 || true)
echo "$CREATE_OUT"
DB_ID=$(echo "$CREATE_OUT" | sed -n 's/.*"database_id": *"\([^"]*\)".*/\1/p' | head -1)
if [ -z "$DB_ID" ]; then
  DB_ID=$(echo "$CREATE_OUT" | sed -n 's/.*database_id *= *\([a-f0-9-]\{36\}\).*/\1/p' | head -1)
fi
if [ -z "$DB_ID" ]; then
  # already exists — list
  LIST=$(npx wrangler d1 list 2>&1 || true)
  echo "$LIST"
  DB_ID=$(echo "$LIST" | awk -v n="$D1_NAME" '$0 ~ n {print}' | grep -oE '[a-f0-9-]{36}' | head -1)
fi
if [ -z "$DB_ID" ]; then
  echo "ABORT: could not resolve database_id for $D1_NAME"
  exit 1
fi
echo "D1 database_id=$DB_ID"

echo "== create R2 $R2_NAME (ok if exists) =="
npx wrangler r2 bucket create "$R2_NAME" 2>&1 || true

# Patch wrangler.jsonc database_id
python3 - << PY
from pathlib import Path
import re
p = Path('wrangler.jsonc')
t = p.read_text()
t2 = re.sub(
  r'"database_id"\s*:\s*"[^"]*"',
  f'"database_id": "$DB_ID"',
  t,
  count=1,
)
p.write_text(t2)
print('patched wrangler.jsonc database_id')
PY

echo "== validate =="
npx wrangler deploy --dry-run --outdir=/tmp/pitchpro-wrangler-dry 2>&1 | tail -40 || true
echo "Done. Next: put secrets, db migrate, then pnpm run deploy (with confirmation)."
