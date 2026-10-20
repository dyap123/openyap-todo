#!/usr/bin/env bash
# Only run by the reviewed oy deploy todo-finance target. Never source service.env.
set -eu
commit=${1:-}
expected=${2:-}
[[ "$commit" =~ ^[a-f0-9]{40}$ && "$expected" =~ ^[a-f0-9]{64}$ ]] || exit 2
base=/srv/openyap/todo-finance
release="$base/releases/$commit"
app=/srv/openyap/app
[ "$(realpath "$0")" = "$release/tools/todo_finance_remote.sh" ] || exit 2
[ -r "$base/secrets/service.env" ] && [ -f "$base/secrets/firebase.json" ] || { echo 'Private service.env and Firebase identity must be provisioned first'; exit 2; }
# Fail if credentials are readable by other host users. No values enter output/args.
for file in "$base/secrets/service.env" "$base/secrets/firebase.json"; do
  mode=$(stat -c %a "$file")
  [ "$mode" = 400 ] || [ "$mode" = 600 ] || { echo 'Secrets need mode 0400 or 0600'; exit 2; }
done
[ "$(sha256sum "$app/Caddyfile" | cut -d' ' -f1)" = "$expected" ] || { echo 'Live Caddyfile changed; review a new candidate'; exit 2; }
docker network inspect openyap_edge >/dev/null
previous=$(readlink -f "$base/current" 2>/dev/null || true)
caddy_applied=false
rollback() {
  result=$?
  trap - EXIT
  if [ "$result" != 0 ]; then
    if [ "$caddy_applied" = true ]; then
      cat "$release/Caddyfile.previous" > "$app/Caddyfile"
      (cd "$app" && docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile) || true
    fi
    if [[ "$previous" =~ ^/srv/openyap/todo-finance/releases/([a-f0-9]{40})$ ]]; then
      FINANCE_COMMIT="${BASH_REMATCH[1]}" docker compose -f "$previous/backend/deploy/compose.yml" up -d --no-deps --no-build todo-finance || true
    else
      docker compose -f "$release/backend/deploy/compose.yml" stop todo-finance || true
    fi
  fi
  exit "$result"
}
export FINANCE_COMMIT="$commit"
trap rollback EXIT
compose="$release/backend/deploy/compose.yml"
# docker compose config can disclose interpolated secrets, so never print it.
[ "$(docker compose -f "$compose" config --services)" = todo-finance ] || exit 2
docker compose -f "$compose" build todo-finance
# Image /data is owned by the nonroot UID; Docker initializes a new named volume from it.
docker compose -f "$compose" up -d --no-deps --wait todo-finance
candidate="$release/Caddyfile.candidate"
python3 - "$app/Caddyfile" "$release/backend/deploy/Caddy.fragment" "$candidate" "$release/backend/deploy/Caddy.global.fragment" <<'PY'
from pathlib import Path
import sys
current=Path(sys.argv[1]).read_text();fragment=Path(sys.argv[2]).read_text()
start='\t# BEGIN managed todo-finance\n';end='\t# END managed todo-finance\n'
if start in current:
    if current.count(start)!=1 or current.count(end)!=1: raise SystemExit('Ambiguous managed block')
    before,rest=current.split(start,1);_,after=rest.split(end,1)
    current=before+fragment+after
else:
    anchor='{$API_DOMAIN} {'
    if current.count(anchor)!=1 or '/todo-finance' in current: raise SystemExit('Review current Caddy site manually')
    current=current.replace(anchor,anchor+'\n'+fragment,1)
global_fragment=Path(sys.argv[4]).read_text()
gstart='\t# BEGIN managed todo-finance-errors\n';gend='\t# END managed todo-finance-errors\n'
if gstart in current:
    if current.count(gstart)!=1 or current.count(gend)!=1: raise SystemExit('Ambiguous error logger block')
    before,rest=current.split(gstart,1);_,after=rest.split(gend,1)
    current=before+global_fragment+after
else:
    if not current.lstrip().startswith('{'): raise SystemExit('Review global Caddy options manually')
    first=current.index('{')+1
    current=current[:first]+'\n'+global_fragment+current[first:]
Path(sys.argv[3]).write_text(current)
PY
# Use the installed Caddy version/modules and existing runtime environment to validate.
# Candidate is passed on stdin, not copied into the mounted live file before validation.
cd "$app"
docker compose exec -T caddy caddy validate --config - --adapter caddyfile < "$candidate"
[ "$(sha256sum "$app/Caddyfile" | cut -d' ' -f1)" = "$expected" ] || { echo 'Caddy changed during validation'; exit 2; }
cp "$app/Caddyfile" "$release/Caddyfile.previous"
# Preserve inode: Caddy has this file bind-mounted. Atomic rename would leave its old mount.
caddy_applied=true
cat "$candidate" > "$app/Caddyfile"
if ! docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
  cat "$release/Caddyfile.previous" > "$app/Caddyfile"
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
  exit 1
fi
# No query strings, cookies or credentials in these probes.
curl --fail --silent --show-error https://api.openyap.org/todo-finance/health
status=$(curl --silent --output /dev/null --write-out '%{http_code}' https://api.openyap.org/todo-finance/v1/status)
[ "$status" = 401 ] || { echo 'Private status authentication probe failed'; exit 1; }
ln -sfn "$release" "$base/current"
echo ' Scoped finance release complete; tokens volume retained.'
