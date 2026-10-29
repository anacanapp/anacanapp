#!/bin/bash
# Captures the nine real-app screens for the store slides into $1 (default ./shots).
H=$(cd "$(dirname "$0")" && pwd); OUT=${1:-$H/../shots/az}; mkdir -p "$OUT"
python3 "$H/build_fixtures.py" "$H/scenarios" >/dev/null; cd "$H/scenarios"
run() { NODE_PATH=$(npm root -g) timeout 300 node "$H/shoot.cjs" "$1" "$OUT/tmp" "$2" | grep -E "shot|pageerror"; }
run bump.json '[{"wait":2000,"shot":"hero"},{"scroll":880,"shot":"pregnancy"}]'
run bump.json '[{"click":"Anacan.AI","exact":true,"wait":2500},{"fill":"textarea","text":"Ürəkbulanmaya nə kömək edir?"},{"press":"Enter","wait":5000,"shot":"ai"},{"click":"Cəmiyyət","exact":true,"wait":3500,"shot":"community"}]'
run flow.json '[{"scroll":470,"shot":"flow"}]'
run mommy.json '[{"wait":2000,"shot":"mommy"},{"click":"Alətlər","exact":true,"wait":2500,"shot":"toolsGrid"},{"click":"Ağlama","wait":3500,"shot":"tools"}]'
run partner.json '[{"wait":2500},{"click":"Keç","exact":true,"optional":true,"wait":1500,"shot":"partner"}]'
for f in "$OUT"/tmp-*.png; do mv "$f" "$OUT/${f##*/tmp-}"; done
ls "$OUT"
