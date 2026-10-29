#!/bin/bash
# Captures the nine real-app screens for one language: capture.sh <lang> [outDir].
# Needs the dev server (see ../README.md). Navigation uses selectors, not translated labels.
set -e
H=$(cd "$(dirname "$0")" && pwd); L=${1:-az}; OUT=${2:-$H/../shots/$L}; SC="$H/scenarios/$L"; mkdir -p "$OUT"
python3 "$H/build_fixtures.py" "$L" "$SC" >/dev/null
Q=$(python3 -c "import json,sys;print(json.load(open('$H/demo/$L.json'))['ai_question'])")
NAV='.a-nav-item'
run() { NODE_PATH=$(npm root -g) timeout 300 node "$H/shoot.cjs" "$SC/$1" "$OUT/tmp" "$2" | grep -E "shot|pageerror" || true; }
run bump.json '[{"wait":2500,"shot":"hero"},{"scroll":880,"shot":"pregnancy"}]'
run bump.json "$(python3 -c "import json;print(json.dumps([{'css':'$NAV:nth-of-type(4)','wait':2500},{'fill':'textarea','text':'''$Q'''},{'press':'Enter','wait':5000,'shot':'ai'},{'css':'$NAV:nth-of-type(3)','wait':3500,'shot':'community'}]))")"
run flow.json '[{"wait":2000},{"scroll":470,"shot":"flow"}]'
run mommy.json '[{"wait":2500,"shot":"mommy"},{"css":".a-nav-item:nth-of-type(2)","wait":2500,"shot":"toolsGrid"},{"css":".a-tool-tile:has(.lucide-mic)","wait":3500,"shot":"tools"}]'
run partner.json '[{"wait":3000,"shot":"partner"}]'
for f in "$OUT"/tmp-*.png; do mv "$f" "$OUT/${f##*/tmp-}"; done
ls "$OUT" | tr '\n' ' '; echo
