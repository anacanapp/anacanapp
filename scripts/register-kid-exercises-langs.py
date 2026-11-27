#!/usr/bin/env python3
"""Regenerates the language lists of Uşaq məşqləri (tile.ts tile text + language list, index.ts loaders)
from the locale files given on the command line (or every src/data/kid-exercises/<lang>.json)."""
import json, re, sys, pathlib
d = pathlib.Path(__file__).resolve().parent.parent / 'src/data/kid-exercises'
langs = sys.argv[1:] or sorted(p.stem for p in d.glob('??.json') if p.stem != 'az')
tile = d / 'tile.ts'; s = tile.read_text()
rows = ["  az: { name: 'Uşaq məşqləri', description: '0–5 yaş üçün şəkilli hərəkət məşqləri' },"]
for l in langs:
    ui = json.loads((d / f'{l}.json').read_text())['ui']
    rows.append(f"  {l}: {{ name: {json.dumps(ui['tileName'], ensure_ascii=False)}, description: {json.dumps(ui['tileDesc'], ensure_ascii=False)} }},")
s = re.sub(r"(KIDEX_TILE_TEXT: Record<string, \{ name: string; description: string \}> = \{\n)(.*?)(\n\};)", lambda m: m.group(1) + '\n'.join(rows) + m.group(3), s, flags=re.S)
s = re.sub(r"export const KIDEX_CONTENT_LANGUAGES = \[.*?\];", 'export const KIDEX_CONTENT_LANGUAGES = [' + ', '.join(repr(x) for x in ['az', *langs]) + '];', s)
tile.write_text(s)
idx = d / 'index.ts'; s = idx.read_text()
loaders = ''.join(f"\n  {l}: () => json(import('./{l}.json'))," for l in langs)
s = re.sub(r"(  az: async \(\) => \(\{ default: \{ ui: KIDEX_UI_AZ, sets: \{\}, groups: \{\}, exercises: \{\} \} \}\),)(.*?)(\n\};)", lambda m: m.group(1) + loaders + m.group(3), s, flags=re.S)
s = s.replace('\nvoid json;', '')
idx.write_text(s)
print('registered', ['az', *langs])
