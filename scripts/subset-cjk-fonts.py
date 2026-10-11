#!/usr/bin/env python3
"""Rebuild the tiny Chinese font files after changing src/i18n/zh-*.json.

Needs: pip install fonttools brotli
       npm install --no-save @fontsource/noto-serif-sc@5.3.1 @fontsource/noto-serif-tc@5.3.1
Run:   python3 scripts/subset-cjk-fonts.py
Only the characters the game actually uses are kept, so each file is a few dozen KB
instead of several MB. Anything else (e.g. prize names typed by the host) falls back to
the device's own Chinese font.
"""
import json, pathlib, subprocess, sys

root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'src' / 'assets' / 'fonts'
out.mkdir(parents=True, exist_ok=True)

def chars(name):
    data = json.loads((root / 'src' / 'i18n' / f'{name}.json').read_text('utf-8'))
    text = json.dumps(data, ensure_ascii=False)
    return ''.join(sorted(set(text) | set('0123456789：，。、！？“”「」……（）简体中文繁體中文')))

jobs = [
    ('zh-Hans', 'noto-serif-sc', 'chinese-simplified', 'noto-serif-sc'),
    ('zh-Hant', 'noto-serif-tc', 'chinese-traditional', 'noto-serif-tc'),
]
for locale, pkg, subset, prefix in jobs:
    text = chars(locale)
    for weight in (500, 700):
        src = root / 'node_modules' / '@fontsource' / pkg / 'files' / f'{prefix}-{subset}-{weight}-normal.woff2'
        if not src.exists():
            sys.exit(f'Missing {src}.\nRun: npm install --no-save @fontsource/noto-serif-sc@5.3.1 @fontsource/noto-serif-tc@5.3.1')
        dst = out / f'{prefix}-{weight}-subset.woff2'
        subprocess.run([sys.executable, '-m', 'fontTools.subset', str(src), f'--text={text}',
                        '--flavor=woff2', f'--output-file={dst}', '--layout-features=*'], check=True)
        print(f'{dst.name}: {dst.stat().st_size // 1024} KB, {len(text)} characters')
