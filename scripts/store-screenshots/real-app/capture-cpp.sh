#!/bin/bash
# Captures the five screens of the "Hər mərhələ" custom product page for one language: capture-cpp.sh <lang> [outDir].
# Same fixtures and dev server as capture.sh; files: flow-top, bump-home, mommy-home, ai-bump, community.
set -e
H=$(cd "$(dirname "$0")" && pwd); L=${1:-az}; OUT=${2:-$H/../shots/$L-cpp}; SC="$H/scenarios/$L"; mkdir -p "$OUT"
python3 "$H/build_fixtures.py" "$L" "$SC" >/dev/null
Q=$(python3 -c "import json,sys;print(json.load(open('$H/demo/$L.json'))['ai_question'])")
NAV='.a-nav-item'
run() { NODE_PATH=$(npm root -g) timeout 300 node "$H/shoot.cjs" "$SC/$1" "$OUT/tmp" "$2" | grep -E "shot|pageerror" || true; }
run bump.json '[{"wait":2500,"shot":"bump-home"}]'
run bump.json "$(python3 -c "import json;print(json.dumps([{'css':'$NAV:nth-of-type(4)','wait':2500},{'css':'[data-testid=ai-consent-accept]','optional':True,'wait':2000},{'fill':'textarea','text':'''$Q'''},{'press':'Enter','wait':5000,'shot':'ai-bump'},{'css':'$NAV:nth-of-type(3)','wait':3500,'shot':'community'}]))")"
run flow.json '[{"wait":2500,"shot":"flow-top"}]'
run mommy.json '[{"wait":2500,"shot":"mommy-home"}]'
for f in "$OUT"/tmp-*.png; do mv "$f" "$OUT/${f##*/tmp-}"; done
ls "$OUT" | tr '\n' ' '; echo
