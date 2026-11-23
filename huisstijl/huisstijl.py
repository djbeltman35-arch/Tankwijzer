#!/usr/bin/env python3
"""Huisstijl van Erik's sites (zelfde stijl als Stroomwekker): donkerblauw en wit, IBM Plex Sans,
groot woordmerk met geel symbool. Draait bij het bouwen op de map die gepubliceerd wordt.

Gebruik: python3 huisstijl/huisstijl.py <publicatiemap> <site>
Wijzigt alleen de gebouwde bestanden in die map, niet de broncode.
"""
import base64, hashlib, os, re, shutil, sys, pathlib

HIER = pathlib.Path(__file__).resolve().parent

# Woordmerk per site: (geel deel, wit deel, symbool, extra css)
SITES = {
    'bespaarvriend':   ('Bespaar', 'vriend', 'groei', 'html body header.top.top:not(.hs-kop){background:#0F2340!important;border-bottom:1px solid #22385C!important;box-shadow:none!important} html body header.top.top .hmenu>summary{background:#F5B700!important;color:#0F2340!important;box-shadow:none!important}'),
    'elektrovergelijk': ('Elektro', 'vergelijk', 'stekker', 'html body header.top.top:not(.hs-kop){background:#0F2340!important;border-bottom:1px solid #22385C!important;box-shadow:none!important} html body header.top.top .hmenu>summary{background:#F5B700!important;color:#0F2340!important;box-shadow:none!important}'),
    'tankwijzer':      ('Tank', 'wijzer', 'druppel', ''),
    'vluchtwijzer':    ('Vlucht', 'wijzer', 'vliegtuig', ''),
    'vakantiewijzer':  ('Vakantie', 'wijzer', 'zon', ''),
    'salderingscheck': ('Saldering', 'check', 'vinkje', ''),
    'euroroadrules':   ('EuroRoad', 'Rules', 'weg', 'html body header.band.band{background:#0F2340!important;color:#fff!important;border-bottom:1px solid #22385C!important} html body header.band.band .toplinks a{color:#E2E9F3!important} html body header.band.band details.mnav>summary,html body header.band.band .langdd>summary{background:transparent!important;color:#fff!important;border:1px solid #3A5175!important} html body header.band.band .hb,html body header.band.band .hb::before,html body header.band.band .hb::after{background:#fff!important}'),
    'foutcodezoeker':  ('Foutcode', 'zoeker', 'loep', 'html body header.top.top:not(.hs-kop){background:#0F2340!important;border-bottom:1px solid #22385C!important;box-shadow:none!important} html body header.top.top details.menu>summary{background:#F5B700!important;color:#0F2340!important;border-color:#F5B700!important} html body header.top.top .burger,html body header.top.top .burger::before,html body header.top.top .burger::after{background:#0F2340!important}'),
}

SYMBOLEN = {
    'groei': '<path d="M0 200 250 105 335 150 525 40 470 30 600 0 585 120 560 70 335 185 250 140 15 225Z"/>',
    'stekker': '<path d="M330 40h70V0h40v40h40V0h40v40h40v60c0 50-40 90-90 95v25h-40v-25c-50-5-90-45-90-95Z"/><path d="M0 200 330 120v25L0 220Z"/>',
    'druppel': '<path d="M470 -15C425 55 390 100 390 145a80 80 0 0 0 160 0c0-45-35-90-80-160Z"/><path d="M0 205 390 140v26L0 225Z"/>',
    'vliegtuig': '<path d="M0 200 400 70l6 18L8 220Z"/><g transform="translate(490 45) rotate(-20) scale(.75)"><path d="M-90 0 60-14C90-16 110-10 110 0s-20 16-50 14L-90 0Z"/><path d="M-10-6 30-80h28L30-8Z"/><path d="M-10 6 30 80h28L30 8Z"/><path d="M-80-3-95-40h18L-55-4Z"/></g>',
    'zon': '<circle cx="490" cy="75" r="55"/><g stroke="#F5B700" stroke-width="16" stroke-linecap="round"><path d="M490 0v-15M490 150v15M415 75h-15M565 75h15M437 22l-11-11M543 128l11 11M437 128l-11 11M543 22l11-11"/></g><path d="M0 205 410 125v24L0 225Z"/>',
    'vinkje': '<path d="M20 120 140 200 600 -10 560 -30 150 150 70 95Z"/>',
    'weg': '<path d="M170 210 330 -10h70l160 220Z"/><path d="M357 20h16l3 40h-22ZM351 90h28l4 50h-36Z" fill="#0F2340"/>',
    'loep': '<circle cx="450" cy="70" r="78" fill="none" stroke="#F5B700" stroke-width="30"/><path d="M500 130 590 230 625 200 535 100Z"/><path d="M0 205 360 110v26L0 225Z"/>',
}

KLEUREN = [  # oude kleur -> huisstijl
    ('#0e7c4a', '#0F2340'), ('#0a6239', '#1A3358'), ('#0b6b3e', '#0F2340'), ('#0a3d2f', '#0F2340'),
    ('#3fbf7f', '#0F2340'), ('#3fbf8f', '#0F2340'), ('#2fb172', '#1A3358'),
    ('#e2f2e8', '#E8EDF5'), ('#e3f4ea', '#E8EDF5'), ('#eef3ea', '#EEF2F7'), ('#f4f7f1', '#F3F5F8'),
    ('#f2f3ef', '#F3F5F8'), ('#e1e7dc', '#DCE2EA'), ('#f7faf5', '#F0F3F7'), ('#e9ece6', '#EEF2F7'),
    ('#1e2a22', '#14213A'), ('#15191e', '#14213A'), ('#5d6a61', '#5B6677'), ('#59626c', '#5B6677'),
    ('#0f4aa8', '#0F2340'), ('#2a66c9', '#1A3358'), ('#e4ecf8', '#E8EDF5'), ('#0f3440', '#0F2340'),
    ('#0a2730', '#0B1A30'), ('#13171b', '#0F2340'), ('#0b0e11', '#0B1A30'), ('#1a1f25', '#0F2340'),
    ('#f2b200', '#F5B700'), ('#f5b400', '#F5B700'), ('#f6b800', '#F5B700'), ('#ffb627', '#F5B700'),
    ('rgba(20,40,28,', 'rgba(15,35,64,'), ('#17a061', '#1A3358'), ('#0b6a3f', '#0B1A30'), ('#08502f', '#0B1A30'),
    ('rgba(8,80,47,', 'rgba(11,26,48,'), ('#0b5e38', '#0B1A30'), ('#0a5a35', '#1A3358'), ('#a9d6bb', '#C9D4E5'),
    ('#cfe6d8', '#DCE3EE'), ('#cfe9da', '#DCE3EE'), ('#cfe9dd', '#DCE3EE'), ('#b9d8c9', '#C9D4E5'), ('#9cc2b1', '#A9B8CF'),
    ('#d8efe5', '#E8EDF5'), ('#08362a', '#0B1A30'), ('#10261a', '#0B1A30'), ('#1c2328', '#0F2340'), ('#13181b', '#0B1A30'), ('#2a3138', '#1B3358'), ('#1b2025', '#0F2340'), ('#22282e', '#0F2340'), ('#262c33', '#1B3358'), ('rgba(14,124,74,', 'rgba(15,35,64,'),
]
FONTS = ['Atkinson Hyperlegible', 'Big Shoulders Display', 'Barlow Condensed', 'Source Sans 3', 'Overpass']

FONTFACE = re.compile(r'@font-face\s*\{[^}]*\}', re.I)
DARK = re.compile(r'prefers-color-scheme\s*:\s*dark', re.I)


def kleur_en_letter(txt):
    # @font-face-blokken laten staan, de rest omzetten
    blokken = []
    txt = FONTFACE.sub(lambda m: blokken.append(m.group(0)) or f'\x00FF{len(blokken)-1}\x00', txt)
    for oud, nieuw in KLEUREN:
        txt = re.sub(re.escape(oud), nieuw, txt, flags=re.I)
    for f in FONTS:
        txt = re.sub(r"(['\"]?)" + re.escape(f) + r"\1", r"\1HSPlex\1", txt)
    txt = DARK.sub('prefers-color-scheme:geen', txt)  # donkere modus uit: één vaste huisstijl
    txt = re.sub(r'\[data-theme=(["\']?)dark\1\]', '[data-theme="geen"]', txt)
    # Platte vormgeving zoals Stroomwekker: geen harde 3D-schaduwen en dikke donkere randen
    txt = re.sub(r'box-shadow:\s*0 [2-6]px 0 (?:#[0-9a-fA-F]{3,6}|rgba\([^)]*\)|var\(--[a-z-]+\))(?=[;}!])', 'box-shadow:0 1px 2px rgba(15,35,64,.08)', txt)
    txt = re.sub(r'border:\s*[23]px solid (?:#0F2340|#14213A|#0B1A30|var\(--ink\)|var\(--navy\)|var\(--road\))', 'border:1px solid #DCE2EA', txt)
    return re.sub('\x00FF(\\d+)\x00', lambda m: blokken[int(m.group(1))], txt)


def woordmerk(site, href='/'):
    a, b, sym, _ = SITES[site]
    n = len(a + b)
    return (f'<header class="hs-kop"><div class="hs-in"><a class="hs-merk" href="{href}" aria-label="{a}{b}, naar de startpagina">'
            f'<span class="hs-woord hs-n{n}"><span class="hs-a">{a}</span><span class="hs-b">{b}'
            f'<svg class="hs-sym" viewBox="0 0 600 200" aria-hidden="true">{SYMBOLEN[sym]}</svg></span></span></a></div></header>')


def verwerk(map_, site, overslaan=('/embed', '/google', '/admin/')):
    root = pathlib.Path(map_)
    doel = root / 'huisstijl'
    doel.mkdir(exist_ok=True)
    if doel.resolve() != HIER:
        shutil.copy(HIER / 'huisstijl.css', doel / 'huisstijl.css')
        (doel / 'fonts').mkdir(exist_ok=True)
        for f in (HIER / 'fonts').glob('*.woff2'):
            shutil.copy(f, doel / 'fonts' / f.name)
    if doel.resolve() != HIER:
        (doel / 'icons').mkdir(exist_ok=True)
        for f in (HIER / 'icons').glob('*.png'):
            shutil.copy(f, doel / 'icons' / f.name)
    extra_css = SITES[site][3] + (SITES['elektrovergelijk'][3] if site == 'bespaarvriend' else '')
    (doel / f'{site}.css').write_text(extra_css + '\n', encoding='utf-8')
    stijlen = set()
    n_html = n_css = 0
    for p in root.rglob('*'):
        if not p.is_file() or 'huisstijl' in p.parts or 'node_modules' in p.parts:
            continue
        rel = '/' + p.relative_to(root).as_posix()
        if p.suffix in ('.js', '.svg') and p.stat().st_size < 3_000_000:
            t = p.read_text(encoding='utf-8', errors='ignore'); t2 = kleur_en_letter(t)
            if t2 != t: p.write_text(t2, encoding='utf-8')
            continue
        if p.suffix == '.css':
            p.write_text(kleur_en_letter(p.read_text(encoding='utf-8', errors='ignore')), encoding='utf-8'); n_css += 1
        elif p.suffix == '.html':
            s = p.read_text(encoding='utf-8', errors='ignore')
            if 'hs-kop' in s or 'huisstijl.css' in s or '<body' not in s or '/google' in rel or '/admin/' in rel:
                continue
            if any(o in rel for o in overslaan):  # ingebedde widget: wel letters en kleuren, geen grote kop
                s = kleur_en_letter(s).replace('</head>', '<link rel="stylesheet" href="/huisstijl/huisstijl.css"></head>', 1)
                p.write_text(s, encoding='utf-8'); continue
            s = kleur_en_letter(s)
            eigen = site
            if site == 'bespaarvriend' and rel.startswith('/elektronica'):
                eigen = 'elektrovergelijk'
            kop = woordmerk(eigen, '/elektronica/' if eigen == 'elektrovergelijk' else '/')
            link = ('<link rel="preload" href="/huisstijl/fonts/ibm-plex-sans-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>'
                    f'<link rel="stylesheet" href="/huisstijl/huisstijl.css"><link rel="stylesheet" href="/huisstijl/{site}.css">')
            s = re.sub(r'<meta name="theme-color"[^>]*>', '<meta name="theme-color" content="#0F2340">', s)
            s = re.sub(r'<link[^>]*rel="(?:shortcut icon|icon|apple-touch-icon|apple-touch-icon-precomposed|mask-icon)"[^>]*>\s*', '', s)
            s = s.replace('</head>', f'<link rel="icon" href="/huisstijl/icons/{eigen}-48.png" type="image/png"><link rel="apple-touch-icon" href="/huisstijl/icons/{eigen}-180.png"></head>', 1)
            s = s.replace('</head>', link + '</head>', 1)
            s = re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + kop, s, count=1)
            for st in re.findall(r'<style[^>]*>(.*?)</style>', s, re.S):
                stijlen.add(st)
            p.write_text(s, encoding='utf-8'); n_html += 1
        elif p.suffix in ('.webmanifest',) or p.name in ('manifest.json', 'site.webmanifest'):
            import json
            try:
                m = json.loads(p.read_text(encoding='utf-8'))
            except Exception:
                continue
            eigen = 'elektrovergelijk' if site == 'bespaarvriend' and 'elektronica' in rel else site
            m['theme_color'] = '#0F2340'; m['background_color'] = '#F3F5F8'
            m['icons'] = [{'src': f'/huisstijl/icons/{eigen}-192.png', 'sizes': '192x192', 'type': 'image/png'},
                          {'src': f'/huisstijl/icons/{eigen}-512.png', 'sizes': '512x512', 'type': 'image/png'},
                          {'src': f'/huisstijl/icons/{eigen}-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]
            p.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding='utf-8')
    csp_hashes(root, stijlen)
    print(f'huisstijl {site}: {n_html} pagina\'s, {n_css} css-bestanden')


def csp_hashes(root, stijlen):
    # Sites met een strenge CSP (stijlen alleen via hash): nieuwe hashes van de aangepaste <style>-blokken toevoegen.
    h = root / '_headers'
    if not h.exists():
        return
    t = h.read_text(encoding='utf-8')
    if 'sha256-' not in t or 'style-src' not in t or not stijlen:
        return
    nieuw = sorted({"'sha256-" + base64.b64encode(hashlib.sha256(x.encode('utf-8')).digest()).decode() + "'" for x in stijlen})
    def vervang(m):
        delen = m.group(0).split()
        oud = [d for d in delen[1:] if not d.startswith("'sha256-")]
        return ' '.join([delen[0]] + oud + nieuw)
    t2 = re.sub(r"style-src[^;\n]*", vervang, t)
    h.write_text(t2, encoding='utf-8')
    print(f'CSP: {len(nieuw)} stijl-hash(es) bijgewerkt')


if __name__ == '__main__':
    verwerk(sys.argv[1], sys.argv[2])
