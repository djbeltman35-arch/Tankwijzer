"""Zet de installeerbalk en de vaste home/terug-knoppen op alle pagina's van een map.

Gebruik: python3 installeerknop.py <map> [--manifest /manifest.webmanifest] [--geen-nav]
Voegt aan elke .html met een </head> toe: <script src="/installeer.js" defer>, en een manifest-link als die ontbreekt.
Het script installeer.js staat naast dit bestand en wordt naar de map gekopieerd.
"""
import os, shutil, sys

args = sys.argv[1:]
MAP = args[0]
MANIFEST = args[args.index("--manifest") + 1] if "--manifest" in args else "/manifest.webmanifest"
GEEN_NAV = "--geen-nav" in args
HIER = os.path.dirname(os.path.abspath(__file__))

if os.path.abspath(HIER) != os.path.abspath(MAP):
    shutil.copy(os.path.join(HIER, "installeer.js"), os.path.join(MAP, "installeer.js"))
TAG = '<script src="/installeer.js" defer></script>'
n = 0
for root, dirs, files in os.walk(MAP):
    dirs[:] = [d for d in dirs if d not in ("embed", "node_modules", ".git")]
    for f in files:
        if not f.endswith(".html") or f.startswith("google"):
            continue
        p = os.path.join(root, f)
        s = open(p, encoding="utf-8").read()
        if "/installeer.js" in s or "</head>" not in s:
            continue
        extra = TAG
        if 'rel="manifest"' not in s and "rel=manifest" not in s:
            extra = f'<link rel="manifest" href="{MANIFEST}">' + extra
        s = s.replace("</head>", extra + "</head>", 1)
        if GEEN_NAV and "data-geen-navknoppen" not in s:
            s = s.replace("<html", "<html data-geen-navknoppen", 1)
        open(p, "w", encoding="utf-8").write(s)
        n += 1
print(f"installeerknop: {n} pagina's in {MAP}")
