#!/usr/bin/env bash
# Downloads the static TTFs bundled by the Flutter app from the official
# fonts.google.com download manifest (same files as the "Download family" zip).
#
# Weights mirror what the web app loads:
#   src/index.css @import  -> Nunito 400;500;600;700;800;900
#                          -> Inter  ital,wght 0,400;0,500;0,600;0,700;0,800;1,400;1,600;1,700
#   src/lib/rtl.ts         -> @fontsource/noto-sans-arabic 400/500/600/700/800
#
# Inter is served on the web as a variable font with an optical-size axis (opsz, auto);
# the 18pt static cut is used because almost all UI text is 10-22px.
#
# Usage: bash app/tool/design/fetch_fonts.sh   (from the repo root)
set -euo pipefail
cd "$(dirname "$0")/../.."   # -> app/
OUT=assets/fonts
mkdir -p "$OUT"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fetch_family() { # $1 query name, $2 out dir, $3.. "manifestPath=outName"
  local q="$1" dir="$2"; shift 2
  mkdir -p "$OUT/$dir"
  curl -fsSL "https://fonts.google.com/download/list?family=$q" | tail -n +2 > "$TMP/m.json"
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).manifest;
    const lic = m.files.find((f) => f.filename === "OFL.txt");
    fs.writeFileSync(process.argv[2] + "/OFL.txt", lic.contents);
    for (const pair of process.argv.slice(3)) {
      const [src, dst] = pair.split("=");
      const ref = m.fileRefs.find((f) => f.filename === src);
      if (!ref) { console.error("missing in manifest: " + src); process.exit(1); }
      console.log(ref.url + " " + process.argv[2] + "/" + dst);
    }
  ' "$TMP/m.json" "$OUT/$dir" "$@" > "$TMP/urls"
  while read -r url dst; do
    curl -fsSL "$url" -o "$dst"
    echo "  $dst"
  done < "$TMP/urls"
}

echo "Nunito"
fetch_family Nunito nunito \
  static/Nunito-Regular.ttf=Nunito-Regular.ttf \
  static/Nunito-Medium.ttf=Nunito-Medium.ttf \
  static/Nunito-SemiBold.ttf=Nunito-SemiBold.ttf \
  static/Nunito-Bold.ttf=Nunito-Bold.ttf \
  static/Nunito-ExtraBold.ttf=Nunito-ExtraBold.ttf \
  static/Nunito-Black.ttf=Nunito-Black.ttf

echo "Inter"
fetch_family Inter inter \
  static/Inter_18pt-Regular.ttf=Inter-Regular.ttf \
  static/Inter_18pt-Medium.ttf=Inter-Medium.ttf \
  static/Inter_18pt-SemiBold.ttf=Inter-SemiBold.ttf \
  static/Inter_18pt-Bold.ttf=Inter-Bold.ttf \
  static/Inter_18pt-ExtraBold.ttf=Inter-ExtraBold.ttf \
  static/Inter_18pt-Italic.ttf=Inter-Italic.ttf \
  static/Inter_18pt-SemiBoldItalic.ttf=Inter-SemiBoldItalic.ttf \
  static/Inter_18pt-BoldItalic.ttf=Inter-BoldItalic.ttf

echo "Noto Sans Arabic"
fetch_family "Noto+Sans+Arabic" noto_sans_arabic \
  static/NotoSansArabic-Regular.ttf=NotoSansArabic-Regular.ttf \
  static/NotoSansArabic-Medium.ttf=NotoSansArabic-Medium.ttf \
  static/NotoSansArabic-SemiBold.ttf=NotoSansArabic-SemiBold.ttf \
  static/NotoSansArabic-Bold.ttf=NotoSansArabic-Bold.ttf \
  static/NotoSansArabic-ExtraBold.ttf=NotoSansArabic-ExtraBold.ttf
echo "done"
