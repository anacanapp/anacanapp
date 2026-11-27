#!/usr/bin/env bash
# Runs the domain test suite under every time zone the fixtures were generated for (zone-specific cases skip
# themselves in other zones). Usage from app/: tool/domain/run_tz_tests.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
for zone in UTC America/New_York Europe/Berlin Asia/Baku; do
  echo "== TZ=$zone"
  TZ="$zone" flutter test test/domain "$@"
done
