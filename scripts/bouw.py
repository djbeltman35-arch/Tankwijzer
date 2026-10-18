"""Bouwt Tankwijzer (goedkopertanken.netlify.app) in public/: de app uit site/ plus de tankgids met actuele prijzen.

Draait op Netlify bij elke wijziging op GitHub (en dagelijks via de GitHub Action die de prijzen bijwerkt).
Lokaal: python3 scripts/bouw.py [uitmap]
Prijzen: eerst de live /data.json van de site (bijgewerkt door de Netlify-functie prijzen-ophalen), anders site/data-basis.json.
"""
import json, math, os, re, shutil, sys, datetime, html, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "public")
BASE = "https://goedkopertanken.netlify.app"
SITE = os.environ.get("SITE_NAME", "")

shutil.rmtree(OUT, ignore_errors=True)
# De oude site (tankgoedkoper) stuurt alles door naar het nieuwe adres.
if SITE == "tankgoedkoper":
    os.makedirs(OUT)
    open(os.path.join(OUT, "_redirects"), "w").write(f"/* {BASE}/:splat 301!\n")
    open(os.path.join(OUT, "index.html"), "w").write(f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={BASE}/"><link rel="canonical" href="{BASE}/"><a href="{BASE}/">Tankwijzer is verhuisd</a>')
    print("doorsturen naar", BASE); sys.exit(0)
shutil.copytree(os.path.join(ROOT, "site"), OUT)

esc = lambda s: html.escape(str(s if s is not None else ""), quote=True)
def haal(url, t=20):
    req = urllib.request.Request(url, headers={"User-Agent": "Tankwijzer-build"})
    with urllib.request.urlopen(req, timeout=t) as r: return json.loads(r.read().decode())

# ---------- prijzen ----------
D = None
try:
    D = haal(BASE + "/data.json")
    if not D.get("updated"): D = None
except Exception as e: print("live prijzen niet bereikbaar:", e)
basis = json.load(open(os.path.join(ROOT, "site", "data-basis.json")))
if not D or D.get("updated", "") < basis.get("updated", ""): D = basis
print("prijzen van", D.get("updated"))

# Nederlandse pompprijs: CBS-daggemiddelde, bijgewerkt met de verandering van de adviesprijs daarna (zoals de app).
CBS = []
try:
    k = (datetime.date.today() - datetime.timedelta(days=60)).strftime("%Y%m%d")
    j = haal("https://opendata.cbs.nl/ODataApi/odata/80416ned/TypedDataSet?$filter=" + urllib.parse.quote(f"Perioden ge '{k}'") + "&$select=Perioden,BenzineEuro95_1,Diesel_2")
    CBS = sorted([r["Perioden"], r["BenzineEuro95_1"], r["Diesel_2"]] for r in j.get("value", []) if r.get("BenzineEuro95_1"))
except Exception as e: print("CBS niet bereikbaar:", e)
if not CBS:
    m = re.search(r"const CBS_FALLBACK = (\[[\s\S]*?\]);", open(os.path.join(ROOT, "site", "app.js")).read())
    CBS = json.loads(m.group(1))
def nl_prijs(f):
    if f == "e5": return (D.get("nl", {}).get("advies", {}) or {}).get("e5")
    i = 1 if f == "e10" else 2
    last = CBS[-1]; ah = D.get("nl", {}).get("adviesHist", [])
    a0 = next((r for r in ah if r[0] == last[0]), None); a1 = ah[-1] if ah else None
    if a0 and a1 and a1[0] > last[0] and a0[i] and a1[i]: return round(last[i] + (a1[i] - a0[i]), 3)
    return last[i]
NL = {f: nl_prijs(f) for f in ("e10", "diesel", "e5")}
be, de = D.get("be", {}), D.get("de", {})
BEMAX, BELOW, BEAVG, BEPROV = be.get("max", {}), be.get("low", {}), be.get("avg", {}), be.get("prov", {})
DEB, DEP = de.get("border", {}), de.get("points", {})

MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"]
def datum(k):
    k = str(k or "").replace("-", "")[:8]
    try: d = datetime.date(int(k[:4]), int(k[4:6]), int(k[6:8])); return f"{d.day} {MAANDEN[d.month - 1]}"
    except Exception: return ""
VANDAAG = datetime.date.today()
MAAND = f"{MAANDEN[VANDAAG.month - 1]} {VANDAAG.year}"
NU = f"{VANDAAG.day} {MAANDEN[VANDAAG.month - 1]} {VANDAAG.year}"
def p3(v): return "–" if v is None else ("%.3f" % v).replace(".", ",")
def eur(v): return ("€ %.2f" % abs(v)).replace(".", ",") if v is not None else "–"
def euro(v): return f'<span class="pp">{p3(v)}</span>'

# ---------- plaatsen ----------
NLSTEDEN = [("Groningen", 53.219, 6.567), ("Winschoten", 53.144, 7.035), ("Stadskanaal", 52.991, 6.950), ("Emmen", 52.785, 6.897), ("Coevorden", 52.661, 6.741),
    ("Hardenberg", 52.575, 6.619), ("Almelo", 52.357, 6.663), ("Oldenzaal", 52.313, 6.929), ("Hengelo", 52.266, 6.793), ("Enschede", 52.221, 6.893),
    ("Winterswijk", 51.972, 6.719), ("Doetinchem", 51.965, 6.289), ("Arnhem", 51.985, 5.899), ("Zevenaar", 51.930, 6.071), ("Nijmegen", 51.842, 5.853),
    ("Gennep", 51.698, 5.973), ("Boxmeer", 51.646, 5.947), ("Venlo", 51.370, 6.172), ("Venray", 51.526, 5.975), ("Roermond", 51.194, 5.987), ("Weert", 51.252, 5.706),
    ("Sittard", 51.000, 5.869), ("Heerlen", 50.888, 5.980), ("Kerkrade", 50.866, 6.063), ("Maastricht", 50.851, 5.690), ("Eindhoven", 51.441, 5.478),
    ("Valkenswaard", 51.351, 5.459), ("Helmond", 51.481, 5.661), ("Tilburg", 51.556, 5.091), ("Breda", 51.589, 4.776), ("Roosendaal", 51.531, 4.465),
    ("Bergen op Zoom", 51.495, 4.287), ("Goes", 51.504, 3.889), ("Terneuzen", 51.335, 3.828), ("Hulst", 51.280, 4.053), ("'s-Hertogenbosch", 51.690, 5.304)]
# naam, slug, land, lat, lng, BE-provincie / DE-punt, nabije NL-plaats voor de kop
PLAATSEN = [
    ("Kleve", "kleve", "DE", 51.788, 6.138, "Kleve"), ("Emmerich", "emmerich", "DE", 51.832, 6.246, "Emmerich"), ("Bocholt", "bocholt", "DE", 51.838, 6.615, "Bocholt"),
    ("Gronau", "gronau", "DE", 52.212, 7.023, "Gronau"), ("Bad Bentheim", "bad-bentheim", "DE", 52.303, 7.159, "Bad Bentheim"), ("Nordhorn", "nordhorn", "DE", 52.433, 7.068, "Nordhorn"),
    ("Bunde", "bunde", "DE", 53.183, 7.270, "Bunde"), ("Kaldenkirchen", "kaldenkirchen", "DE", 51.318, 6.196, "Kaldenkirchen"), ("Aken", "aken", "DE", 50.776, 6.084, "Aken"),
    ("Lanaken", "lanaken", "BE", 50.893, 5.648, "Limburg"), ("Wezet (Visé)", "vise", "BE", 50.737, 5.698, "Luik"), ("Maaseik", "maaseik", "BE", 51.098, 5.784, "Limburg"),
    ("Hamont-Achel", "hamont-achel", "BE", 51.252, 5.547, "Limburg"), ("Lommel", "lommel", "BE", 51.230, 5.313, "Limburg"), ("Poppel", "poppel", "BE", 51.449, 5.040, "Antwerpen"),
    ("Meer (Hoogstraten)", "meer-hoogstraten", "BE", 51.447, 4.735, "Antwerpen"), ("Essen", "essen", "BE", 51.468, 4.468, "Antwerpen"), ("Zelzate", "zelzate", "BE", 51.199, 3.811, "Oost-Vlaanderen")]
def hav(a, b):
    R = 6371; la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))
def plaatsprijs(pl, f):
    naam, slug, cc, lat, lng, k = pl
    if cc == "DE":
        v = (DEP.get(k) or {}).get(f)
        return (v, (DEP.get(k) or {}).get(f + "Waar")) if v else (DEB.get(f), None)
    v = (BEPROV.get(k) or {}).get(f)
    return (v, f"laagste prijs in provincie {k}") if v else (BELOW.get(f) or BEMAX.get(f), None)
LITERS, VERBRUIK, OMRIJ = 50, 6.67, 1.3  # volle tank, 1 op 15, wegfactor
def besparing(nl, p, km):
    if nl is None or p is None: return None
    return (nl - p) * LITERS - km * VERBRUIK / 100 * p

# ---------- sjabloon ----------
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Figtree:wght@400;600;700&family=JetBrains+Mono:wght@500;700&display=swap">'
GC = '<script data-goatcounter="https://goedkopertanken.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>'
NAV = [("/", "Tankwijzer"), ("/gids/prijzen-vandaag.html", "Prijzen vandaag"), ("/gids/grensplaatsen.html", "Grensplaatsen"), ("/gids/", "Tankgids")]
FOOT = ('<footer class="foot"><p class="free">Tankwijzer is gratis en onafhankelijk: geen reclame, geen betaalde plekken, geen commissie. Ik verdien er geen cent aan.</p>'
        '<nav><a href="/">Tankwijzer openen</a><a href="/gids/prijzen-vandaag.html">Prijzen vandaag</a><a href="/gids/grensplaatsen.html">Grensplaatsen</a><a href="/gids/">Tankgids</a><a href="/gids/over.html">Over en privacy</a></nav>'
        '<p class="apps">Meer van Erik: <a href="https://goedkopeboodschappen.netlify.app/">Goedkope Boodschappen</a> · <a href="https://vluchtwijzer.netlify.app/">Vluchtwijzer</a> · <a href="https://vakantietoppers.netlify.app/">Vakantiewijzer</a></p>'
        f'<p class="small">Prijzen bijgewerkt op {esc(NU)}. Bronnen: Tankerkönig/Markttransparenzstelle (CC BY 4.0), carbu.com, UnitedConsumers, CBS, EU Oil Bulletin. De prijs aan de pomp is leidend. <a href="mailto:erik@beltman.email">Made by Erik</a></p></footer>')
# Werkt de getallen bij zodra iemand de pagina opent (de pagina zelf wordt dagelijks opnieuw gebouwd).
LIVEJS = '''<script>fetch("/data.json").then(r=>r.json()).then(d=>{const g=(o,p)=>p.split(".").reduce((a,k)=>a&&a[k],o);document.querySelectorAll("[data-k]").forEach(e=>{const v=g(d,e.dataset.k);if(typeof v==="number"&&v>.5)e.textContent=v.toFixed(3).replace(".",",")});const t=document.getElementById("bijgewerkt");if(t&&d.updated)t.textContent=new Date(d.updated).toLocaleString("nl-NL",{day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})}).catch(()=>{})</script>'''
def pagina(pad, titel, omschrijving, kop, inhoud, ld=None, kruimel=None):
    lds = [ld] if isinstance(ld, dict) else (ld or [])
    if kruimel:
        lds.append({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, **({"item": BASE + u} if u else {})} for i, (n, u) in enumerate(kruimel)]})
        kr = '<p class="crumbs">' + " › ".join(f'<a href="{u}">{esc(n)}</a>' if u else esc(n) for n, u in kruimel) + "</p>"
    else: kr = ""
    nav = "".join(f'<a href="{u}"{" aria-current=page" if u == pad else ""}>{t}</a>' for u, t in NAV)
    ldtags = "".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in lds)
    return f'''<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(titel)}</title><meta name="description" content="{esc(omschrijving)}"><link rel="canonical" href="{BASE}{pad}"><meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="article"><meta property="og:locale" content="nl_NL"><meta property="og:site_name" content="Tankwijzer"><meta property="og:url" content="{BASE}{pad}"><meta property="og:title" content="{esc(titel)}"><meta property="og:description" content="{esc(omschrijving)}"><meta property="og:image" content="{BASE}/og.png"><meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#13201f"><link rel="icon" href="/icon-192.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
{FONTS}<link rel="stylesheet" href="/gids.css">{ldtags}{GC}</head><body>
<header class="top"><div class="wrap bar"><a class="logo" href="/">Tank<b>wijzer</b></a><nav>{nav}</nav></div></header>
<main class="wrap">{kr}<h1>{esc(kop)}</h1>{inhoud}
<p class="cta"><a class="knop" href="/">Open Tankwijzer en zoek het goedkoopste station</a></p></main>
<div class="wrap">{FOOT}</div>{LIVEJS}</body></html>'''
def schrijf(pad, inhoud):
    p = os.path.join(OUT, pad.strip("/"), "index.html") if pad.endswith("/") else os.path.join(OUT, pad.lstrip("/"))
    os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(inhoud)
def faq(vragen):
    return ('<section class="faq"><h2>Veelgestelde vragen</h2>' + "".join(f"<h3>{esc(q)}</h3><p>{esc(a)}</p>" for q, a in vragen) + "</section>",
            {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in vragen]})
def kort(tekst): return f'<p class="kort" id="kort">{tekst}</p>'
SPEAK = lambda pad, naam: {"@context": "https://schema.org", "@type": "WebPage", "name": naam, "url": BASE + pad, "inLanguage": "nl", "dateModified": VANDAAG.isoformat(), "speakable": {"@type": "SpeakableSpecification", "cssSelector": ["#kort"]}}
gemaakt = []

# ---------- prijzen vandaag ----------
def besparing_tank(nl, p): return None if nl is None or p is None else (nl - p) * LITERS
goedkoopst_e10 = min([("België", BELOW.get("e10")), ("Duitsland", DEB.get("e10"))], key=lambda x: x[1] or 9)
rijen = [("Nederland", "gemiddelde pompprijs (schatting)", NL["e10"], NL["diesel"], NL["e5"], None, "nl"),
         ("België", "maximumprijs " + datum(BEMAX.get("date")), BEMAX.get("e10"), BEMAX.get("diesel"), BEMAX.get("e5"), "be.max", "be"),
         ("België", "laagste prijs grensprovincies", BELOW.get("e10"), BELOW.get("diesel"), BELOW.get("e5"), "be.low", "be"),
         ("België", "gemiddelde pompprijs (week " + datum(BEAVG.get("date")) + ")", BEAVG.get("e10"), BEAVG.get("diesel"), None, "be.avg", "be"),
         ("Duitsland", "goedkoopste station aan de grens", DEB.get("e10"), DEB.get("diesel"), DEB.get("e5"), "de.border", "de"),
         ("Duitsland", "middenprijs grensstations", (de.get("borderMid") or {}).get("e10"), (de.get("borderMid") or {}).get("diesel"), (de.get("borderMid") or {}).get("e5"), "de.borderMid", "de")]
def cel(v, k, f): return f'<td class="p"><span{f" data-k=\"{k}.{f}\"" if k else ""}>{p3(v)}</span></td>'
tabel = ('<div class="tw"><table class="pt"><thead><tr><th>Land</th><th class="p">Euro95/E10</th><th class="p">Diesel</th><th class="p">Super 98/E5</th></tr></thead><tbody>' +
         "".join(f'<tr><td><i class="flag {fl}"></i><b>{l}</b><span class="sub">{esc(o)}</span></td>{cel(a, k, "e10")}{cel(b, k, "diesel")}{cel(c, k, "e5")}</tr>' for l, o, a, b, c, k, fl in rijen) + "</tbody></table></div>")
prov = ('<h2>België per provincie</h2><p>Laagste prijs per provincie vandaag, volgens carbu.com.</p><div class="tw"><table class="pt"><thead><tr><th>Provincie</th><th class="p">E10</th><th class="p">Diesel</th><th class="p">LPG</th></tr></thead><tbody>' +
        "".join(f'<tr><td>{esc(n)}</td>{cel(v.get("e10"), "be.prov." + n, "e10")}{cel(v.get("diesel"), "be.prov." + n, "diesel")}{cel(v.get("lpg"), "be.prov." + n, "lpg")}</tr>' for n, v in BEPROV.items() if isinstance(v, dict)) + "</tbody></table></div>") if BEPROV else ""
punten = ('<h2>Duitsland per grensplaats</h2><p>Goedkoopste open tankstation (geen snelweg) binnen 6 km, live via de Markttransparenzstelle.</p><div class="tw"><table class="pt"><thead><tr><th>Plaats</th><th class="p">E10</th><th class="p">Diesel</th></tr></thead><tbody>' +
          "".join(f'<tr><td>{esc(n)}<span class="sub">{esc(v.get("e10Waar") or "")}</span></td>{cel(v.get("e10"), "de.points." + n, "e10")}{cel(v.get("diesel"), "de.points." + n, "diesel")}</tr>' for n, v in DEP.items() if isinstance(v, dict)) + "</tbody></table></div>") if any(isinstance(v, dict) for v in DEP.values()) else ""
sp_be, sp_de = besparing_tank(NL["e10"], BELOW.get("e10")), besparing_tank(NL["e10"], DEB.get("e10"))
kort_pv = (f"Vandaag tank je Euro95 (E10) het goedkoopst in {goedkoopst_e10[0]}: vanaf € {p3(goedkoopst_e10[1])} per liter, tegen ongeveer € {p3(NL['e10'])} in Nederland. "
           f"Diesel kost aan de Duitse grens vanaf € {p3(DEB.get('diesel'))} en in de Belgische grensprovincies vanaf € {p3(BELOW.get('diesel'))}.")
vr = [("Waar is tanken vandaag het goedkoopst?", kort_pv),
      ("Hoeveel bespaar ik met een volle tank in België?", f"Met {LITERS} liter Euro95 bespaar je bij de goedkoopste Belgische grensstations vandaag ongeveer {eur(sp_be)} tegenover de Nederlandse pompprijs, vóór de kosten van het omrijden." if sp_be else ""),
      ("Hoeveel bespaar ik met een volle tank in Duitsland?", f"Met {LITERS} liter Euro95 (E10) bespaar je bij het goedkoopste Duitse grensstation vandaag ongeveer {eur(sp_de)} tegenover de Nederlandse pompprijs, vóór de kosten van het omrijden." if sp_de else ""),
      ("Hoe vaak worden deze prijzen bijgewerkt?", "De Duitse prijzen elk half uur (live van de Markttransparenzstelle), de Belgische maximumprijs en provincieprijzen dagelijks, de Nederlandse prijs dagelijks.")]
vr = [x for x in vr if x[1]]
fh, fl = faq(vr)
inhoud = (kort(kort_pv) + f'<p class="meta">Bijgewerkt: <span id="bijgewerkt">{esc(datum(D.get("updated", "")[:10]))}</span> · prijzen in euro per liter</p>' + tabel +
          (f'<div class="tegels"><div><span>Volle tank E10 in België</span><b>{eur(sp_be)}</b><small>goedkoper dan in NL</small></div><div><span>Volle tank E10 in Duitsland</span><b>{eur(sp_de)}</b><small>goedkoper dan in NL</small></div></div>' if sp_be and sp_de else "") +
          '<p class="note">Besparing voor 50 liter, vóór de kosten van het omrijden. Tankwijzer rekent je netto besparing uit vanaf je eigen locatie.</p>' +
          punten + prov + fh)
schrijf("/gids/prijzen-vandaag.html", pagina("/gids/prijzen-vandaag.html", f"Benzineprijs vandaag in Nederland, België en Duitsland ({MAAND})",
    f"Euro95 vandaag vanaf € {p3(goedkoopst_e10[1])} in {goedkoopst_e10[0]}, in Nederland ± € {p3(NL['e10'])}. Live grensprijzen Duitsland, Belgische maximumprijs en provincieprijzen naast elkaar.",
    "Brandstofprijzen vandaag", inhoud, [fl, SPEAK("/gids/prijzen-vandaag.html", "Brandstofprijzen vandaag"),
    {"@context": "https://schema.org", "@type": "Dataset", "name": "Brandstofprijzen Nederland, België en Duitsland", "description": "Dagelijkse benzine- en dieselprijzen: Nederlandse pompprijs, Belgische maximumprijs en provincieprijzen, Duitse grensprijzen.", "url": BASE + "/gids/prijzen-vandaag.html", "creator": {"@type": "Person", "name": "Erik"}, "isAccessibleForFree": True, "license": "https://creativecommons.org/licenses/by/4.0/", "distribution": [{"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": BASE + "/data.json"}], "temporalCoverage": VANDAAG.isoformat(), "spatialCoverage": "Nederland, België, Duitsland"}],
    [("Home", "/"), ("Tankgids", "/gids/"), ("Prijzen vandaag", None)]))
gemaakt.append(("/gids/prijzen-vandaag.html", "0.9"))

# ---------- grensplaatsen ----------
def pl_regels(pl, f="e10"):
    naam, slug, cc, lat, lng, k = pl
    p, waar = plaatsprijs(pl, f)
    steden = sorted(((n, hav((lat, lng), (a, b))) for n, a, b in NLSTEDEN), key=lambda x: x[1])
    steden = [s for s in steden if s[1] <= 60][:5] or steden[:3]
    return p, waar, [(n, round(km * OMRIJ * 2), besparing(NL[f], p, km * OMRIJ * 2)) for n, km in steden]
lijst = ""
for land in ("DE", "BE"):
    lijst += f'<h2>{"Duitsland" if land == "DE" else "België"}</h2><div class="tw"><table class="pt"><thead><tr><th>Plaats</th><th class="p">E10</th><th class="p">Diesel</th><th class="p">Volle tank E10*</th></tr></thead><tbody>'
    for pl in [x for x in PLAATSEN if x[2] == land]:
        p, waar, r = pl_regels(pl); pd, _, _ = pl_regels(pl, "diesel")
        beste = max((x[2] for x in r if x[2] is not None), default=None)
        lijst += f'<tr><td><a href="/gids/tanken-in-{pl[1]}.html"><b>{esc(pl[0])}</b></a><span class="sub">vanuit {esc(r[0][0])}</span></td><td class="p">{p3(p)}</td><td class="p">{p3(pd)}</td><td class="p">{eur(beste) if beste is not None else "–"}</td></tr>'
    lijst += "</tbody></table></div>"
kort_gp = "Tank je vlak over de grens, dan bespaar je vaak een tientje of meer per volle tank. Hieronder per grensplaats de prijs van vandaag en wat een volle tank oplevert vanuit de dichtstbijzijnde Nederlandse plaats, na aftrek van de rit."
schrijf("/gids/grensplaatsen.html", pagina("/gids/grensplaatsen.html", f"Goedkoop tanken over de grens: 18 grensplaatsen vergeleken ({MAAND})",
    "Tanken in Kleve, Emmerich, Gronau, Aken, Lanaken, Poppel en meer: de prijs van vandaag per grensplaats en wat je bespaart na aftrek van de rit.",
    "Tanken over de grens: alle grensplaatsen", kort(kort_gp) + lijst + '<p class="note">* Besparing met 50 liter Euro95 tegenover de Nederlandse pompprijs, vanuit de dichtstbijzijnde Nederlandse plaats, na aftrek van de brandstof voor de heen- en terugrit (1 op 15).</p>',
    [SPEAK("/gids/grensplaatsen.html", "Grensplaatsen")], [("Home", "/"), ("Tankgids", "/gids/"), ("Grensplaatsen", None)]))
gemaakt.append(("/gids/grensplaatsen.html", "0.9"))

for pl in PLAATSEN:
    naam, slug, cc, lat, lng, k = pl
    pe, waar_e, re10 = pl_regels(pl, "e10"); pdz, waar_d, rd = pl_regels(pl, "diesel")
    landnaam = "Duitsland" if cc == "DE" else "België"
    beste = max(re10, key=lambda x: x[2] if x[2] is not None else -1e9)
    rows = "".join(f'<tr><td>{esc(n)}</td><td class="p">{km} km</td><td class="p {"pos" if (a or 0) > 0 else "neg"}">{eur(a) if a is not None else "–"}{"" if (a or 0) >= 0 else " verlies"}</td><td class="p {"pos" if (b or 0) > 0 else "neg"}">{eur(b) if b is not None else "–"}{"" if (b or 0) >= 0 else " verlies"}</td></tr>'
                   for (n, km, a), (_, _, b) in zip(re10, rd))
    loont = beste[2] is not None and beste[2] > 0
    kort_pl = (f"Euro95 (E10) kost in {naam} vandaag vanaf € {p3(pe)} per liter, tegen ongeveer € {p3(NL['e10'])} in Nederland. "
               + (f"Vanuit {beste[0]} bespaar je met een volle tank ongeveer {eur(beste[2])}, ook na aftrek van de rit." if loont else "Omrijden levert vandaag weinig of niets op."))
    tips = (["Tank vlak vóór 12:00 uur: Duitse stations mogen de prijs maar één keer per dag verhogen, om 12 uur.", "Mijd stations aan de Autobahn: die zijn het duurst.", "Onbemande stations (SB-Tankstelle) zijn vaak goedkoper."] if cc == "DE" else
            ["Kijk naar de maximumprijs van morgen: gaat die omhoog, tank dan vandaag.", "Onbemande stations zitten vaak flink onder de maximumprijs.", "Neem hoogstens 10 liter extra mee in een reservekan; meer moet je aangeven bij de douane."])
    vr = [(f"Is tanken in {naam} goedkoper dan in Nederland?", kort_pl),
          (f"Wat kost diesel in {naam}?", f"Diesel kost in {naam} vandaag vanaf € {p3(pdz)} per liter, tegen ongeveer € {p3(NL['diesel'])} in Nederland."),
          (f"Wanneer kun je het beste tanken in {naam}?", "Vlak vóór 12:00 uur. Daarna mogen de prijzen omhoog, verlagen kan de rest van de dag." if cc == "DE" else "Als de maximumprijs morgen omhooggaat, tank je beter vandaag. Veel stations zitten onder de maximumprijs.")]
    fh, fl = faq(vr)
    waarregel = f'<p class="meta">Goedkoopste station: {esc(waar_e)}</p>' if waar_e and cc == "DE" else (f'<p class="meta">{esc(waar_e)}</p>' if waar_e else "")
    kk = f"de.points.{k}" if cc == "DE" and DEP.get(k) else (f"be.prov.{k}" if cc == "BE" and BEPROV.get(k) else None)
    tegels = (f'<div class="tegels"><div><span>Euro95 / E10 in {esc(naam)}</span><b><span{f" data-k=\"{kk}.e10\"" if kk else ""}>{p3(pe)}</span></b><small>NL ± {p3(NL["e10"])}</small></div>'
              f'<div><span>Diesel in {esc(naam)}</span><b><span{f" data-k=\"{kk}.diesel\"" if kk else ""}>{p3(pdz)}</span></b><small>NL ± {p3(NL["diesel"])}</small></div></div>')
    inhoud = (kort(kort_pl) + f'<p class="meta">Prijzen van {esc(NU)} in euro per liter.</p>' + tegels + waarregel +
              f'<h2>Wat levert een volle tank op?</h2><p>{LITERS} liter, na aftrek van de brandstof voor heen en terug (1 op 15).</p>'
              f'<div class="tw"><table class="pt"><thead><tr><th>Vanuit</th><th class="p">Rit</th><th class="p">E10</th><th class="p">Diesel</th></tr></thead><tbody>{rows}</tbody></table></div>'
              f'<h2>Tips voor tanken in {esc(naam)}</h2><ul>' + "".join(f"<li>{esc(t)}</li>" for t in tips) + "</ul>" +
              f'<p><a class="knop sec" href="/?q={urllib.parse.quote(naam.split(" (")[0])}">Bekijk alle tankstations in {esc(naam)}</a></p>' + fh +
              '<p class="meta"><a href="/gids/grensplaatsen.html">Alle grensplaatsen vergelijken</a> · <a href="/gids/tanken-in-' + ("duitsland" if cc == "DE" else "belgie") + f'.html">Meer over tanken in {landnaam}</a></p>')
    pad = f"/gids/tanken-in-{slug}.html"
    schrijf(pad, pagina(pad, f"Tanken in {naam}: prijs vandaag € {p3(pe)} ({MAAND})",
        f"Benzine in {naam} vandaag vanaf € {p3(pe)}, diesel vanaf € {p3(pdz)}. Zie wat een volle tank je oplevert vanuit {re10[0][0]} en omgeving, na aftrek van de rit.",
        f"Tanken in {naam}", inhoud, [fl, SPEAK(pad, f"Tanken in {naam}"), {"@context": "https://schema.org", "@type": "Place", "name": naam, "geo": {"@type": "GeoCoordinates", "latitude": lat, "longitude": lng}, "address": {"@type": "PostalAddress", "addressCountry": cc}}],
        [("Home", "/"), ("Grensplaatsen", "/gids/grensplaatsen.html"), (naam, None)]))
    gemaakt.append((pad, "0.8"))

# ---------- artikelen ----------
ART = []
def artikel(slug, titel, kop, omschrijving, kortst, blokken, vragen, bronnen):
    fh, fl = faq(vragen)
    inhoud = kort(kortst) + f'<p class="meta">Bijgewerkt op {esc(NU)}</p>' + blokken + fh + '<p class="bronnen">Bronnen: ' + " · ".join(f'<a href="{u}" rel="noopener" target="_blank">{esc(n)}</a>' for n, u in bronnen) + "</p>"
    pad = f"/gids/{slug}.html"
    schrijf(pad, pagina(pad, titel, omschrijving, kop, inhoud, [fl, SPEAK(pad, kop), {"@context": "https://schema.org", "@type": "Article", "headline": kop, "dateModified": VANDAAG.isoformat(), "author": {"@type": "Person", "name": "Erik"}, "publisher": {"@type": "Organization", "name": "Tankwijzer"}, "mainEntityOfPage": BASE + pad, "image": BASE + "/og.png"}],
        [("Home", "/"), ("Tankgids", "/gids/"), (kop, None)]))
    ART.append((pad, kop, omschrijving)); gemaakt.append((pad, "0.7"))

d_e10 = (NL["e10"] - DEB["e10"]) if DEB.get("e10") and NL["e10"] else None
artikel("tanken-in-duitsland", f"Tanken in Duitsland: de 12-uurregel en prijzen van vandaag ({MAAND})", "Tanken in Duitsland",
    f"Duitse tankstations mogen de prijs maar één keer per dag verhogen, om 12 uur. Tank dus vlak daarvoor. Vandaag E10 aan de grens vanaf € {p3(DEB.get('e10'))}.",
    f"Tank in Duitsland vlak vóór 12:00 uur. Sinds april 2026 mogen Duitse tankstations de prijs maar één keer per dag verhogen, precies om 12 uur. Vandaag kost E10 bij het goedkoopste grensstation € {p3(DEB.get('e10'))} per liter.",
    f'''<h2>De 12-uurregel</h2><p>Sinds 1 april 2026 mogen tankstations in Duitsland hun prijs nog maar één keer per dag verhogen: om 12:00 uur. Verlagen mag de hele dag. Daardoor is het vlak vóór 12 uur meestal het goedkoopst. Volgens de ADAC gaat E10 om 12 uur gemiddeld zo'n 15 cent per liter omhoog en diesel ruim 18 cent. Vóór april was de avond het voordeligst.</p>
<h2>Tijdelijk lagere belasting</h2><p>Van 1 oktober tot en met 31 december 2026 is de Duitse energiebelasting op benzine en diesel tijdelijk verlaagd met 14,04 cent per liter, ongeveer 16,7 cent inclusief btw.</p>
<h2>Prijzen vandaag</h2><div class="tw"><table class="pt"><tbody>
<tr><td>Nederland, gemiddelde pompprijs (schatting)</td><td class="p">E10 {p3(NL["e10"])}</td><td class="p">diesel {p3(NL["diesel"])}</td></tr>
<tr><td>Duitsland, goedkoopste grensstation</td><td class="p">E10 <span data-k="de.border.e10">{p3(DEB.get("e10"))}</span></td><td class="p">diesel <span data-k="de.border.diesel">{p3(DEB.get("diesel"))}</span></td></tr>
<tr><td>Duitsland, middenprijs grensstations</td><td class="p">E10 <span data-k="de.borderMid.e10">{p3((de.get("borderMid") or {}).get("e10"))}</span></td><td class="p">diesel <span data-k="de.borderMid.diesel">{p3((de.get("borderMid") or {}).get("diesel"))}</span></td></tr></tbody></table></div>
{f"<p>Met een volle tank van 50 liter E10 scheelt dat vandaag ongeveer {eur(d_e10 * 50)}, vóór de kosten van het omrijden.</p>" if d_e10 and d_e10 > 0 else ""}
<h2>Duitsland of België?</h2><p>Benzine is in België meestal nog goedkoper dan in Duitsland. Bij diesel ligt het dichter bij elkaar. Tankwijzer vergelijkt het voor je vanaf je eigen locatie.</p>
<h2>Tips</h2><ul><li>Mijd stations aan de Autobahn: die zijn het duurst.</li><li>Onbemande stations (SB-Tankstelle) zijn vaak goedkoper.</li><li>Alle Duitse stations moeten hun prijs binnen minuten melden bij de Markttransparenzstelle. Tankwijzer toont die prijzen live.</li></ul>''',
    [("Wanneer is tanken in Duitsland het goedkoopst?", "Vlak vóór 12:00 uur. Om 12 uur mogen de prijzen omhoog, daarna mogen ze alleen nog dalen."),
     ("Wat is de 12-uurregel?", "Sinds 1 april 2026 mogen Duitse tankstations de prijs maar één keer per dag verhogen, om 12 uur. Verlagen mag altijd."),
     ("Is de brandstofbelasting in Duitsland verlaagd?", "Ja, van 1 oktober tot en met 31 december 2026 met 14,04 cent per liter, ongeveer 16,7 cent inclusief btw."),
     ("Is diesel goedkoper in Duitsland of in België?", "Het verschil is klein en wisselt. Benzine is meestal goedkoper in België.")],
    [("ADAC", "https://www.adac.de/verkehr/tanken-kraftstoff-antrieb/"), ("Markttransparenzstelle via Tankerkönig", "https://creativecommons.tankerkoenig.de/")])
artikel("tanken-in-belgie", f"Tanken in België: maximumprijs en besparing ({MAAND})", "Tanken in België",
    f"In België geldt een maximumprijs per liter. Vandaag: E10 max € {p3(BEMAX.get('e10'))}, maar in de grensprovincies al vanaf € {p3(BELOW.get('e10'))}.",
    f"België heeft een maximumprijs voor brandstof. Vandaag is dat € {p3(BEMAX.get('e10'))} voor Euro95 (E10) en € {p3(BEMAX.get('diesel'))} voor diesel. Veel stations zitten daar ruim onder: in de grensprovincies kost E10 vandaag vanaf € {p3(BELOW.get('e10'))}.",
    f'''<h2>Hoe werkt de maximumprijs?</h2><p>De Belgische overheid (FOD Economie) stelt elke werkdag een maximumprijs per liter vast, op basis van de olieprijzen. Tankstations mogen daar niet boven gaan, maar wel onder. Vooral onbemande stations zitten vaak flink lager.</p>
<h2>Prijzen vandaag</h2><div class="tw"><table class="pt"><tbody>
<tr><td>Maximumprijs ({esc(datum(BEMAX.get("date")))})</td><td class="p">E10 <span data-k="be.max.e10">{p3(BEMAX.get("e10"))}</span></td><td class="p">diesel <span data-k="be.max.diesel">{p3(BEMAX.get("diesel"))}</span></td></tr>
<tr><td>Laagste prijs grensprovincies</td><td class="p">E10 <span data-k="be.low.e10">{p3(BELOW.get("e10"))}</span></td><td class="p">diesel <span data-k="be.low.diesel">{p3(BELOW.get("diesel"))}</span></td></tr>
<tr><td>Nederland, gemiddelde pompprijs (schatting)</td><td class="p">E10 {p3(NL["e10"])}</td><td class="p">diesel {p3(NL["diesel"])}</td></tr></tbody></table></div>
{f"<p>Een volle tank van 50 liter E10 is in een Belgische grensprovincie vandaag ongeveer {eur((NL['e10'] - BELOW['e10']) * 50)} goedkoper dan in Nederland, vóór de kosten van het omrijden.</p>" if BELOW.get("e10") and NL["e10"] else ""}
<h2>Tips</h2><ul><li>Vergelijk stations, niet alleen de maximumprijs.</li><li>Een prijswijziging staat meestal een dag van tevoren vast. Gaat de prijs morgen omhoog, tank dan vandaag. Tankwijzer laat het zien.</li><li>E10 heet in België "Euro 95 E10".</li><li>Hoogstens 10 liter extra in een reservekan; meer moet je aangeven bij de douane.</li></ul>''',
    [("Wat is de maximumprijs in België?", f"Vandaag € {p3(BEMAX.get('e10'))} per liter voor Euro95 (E10) en € {p3(BEMAX.get('diesel'))} voor diesel. Tankstations mogen er niet boven, wel onder."),
     ("Is tanken in België goedkoper dan in Nederland?", f"Ja. In de grensprovincies kost E10 vandaag vanaf € {p3(BELOW.get('e10'))}, in Nederland ongeveer € {p3(NL['e10'])}."),
     ("Mag ik een jerrycan vullen in België?", "Een reservekan van hoogstens 10 liter mag je belastingvrij meenemen. Meer moet je aangeven bij de Nederlandse douane.")],
    [("carbu.com", "https://carbu.com/belgie/maximumprijs"), ("FOD Economie", "https://economie.fgov.be/nl/themas/energie/energieprijzen/maximumprijzen")])
artikel("jerrycan-brandstof-meenemen-grens", "Jerrycan met benzine of diesel meenemen over de grens: wat mag?", "Jerrycan meenemen over de grens: wat mag?",
    "Je tank mag vol, en één reservekan van hoogstens 10 liter mag belastingvrij mee. Meer moet je aangeven bij de douane. Alle regels op een rij.",
    "Je eigen tank mag je in België of Duitsland gewoon vol tanken. Daarnaast mag je één reservekan van hoogstens 10 liter belastingvrij meenemen naar Nederland. Meer moet je aangeven bij de douane.",
    '''<h2>Wat mag belastingvrij mee?</h2><ul><li>Een volle tank in je auto.</li><li>Eén reservekan van hoogstens 10 liter.</li></ul>
<h2>Meer dan 10 liter</h2><p>Neem je meer mee, dan moet je dat aangeven bij de Nederlandse douane en betaal je over het extra Nederlandse accijns en btw. Doe je dat niet, dan riskeer je een naheffing en een boete. Meestal loont het daardoor niet om extra jerrycans te vullen.</p>
<h2>Veilig vervoeren en bewaren</h2><ul><li>Gebruik alleen goedgekeurde jerrycans en zet ze goed vast in de auto.</li><li>Brandweer en ANWB raden het afvullen in jerrycans af vanwege brand- en lekgevaar.</li><li>Thuis mag je in een woning of gewone garage hoogstens 25 liter bewaren, in een gesloten kan en uit de buurt van warmte.</li></ul>''',
    [("Hoeveel brandstof mag ik meenemen uit België of Duitsland?", "Een volle tank en één reservekan van hoogstens 10 liter, zonder iets aan te geven."),
     ("Wat gebeurt er als ik meer meeneem?", "Dan moet je het aangeven bij de douane en betaal je Nederlandse accijns en btw over het extra. Zonder aangifte riskeer je een naheffing en een boete."),
     ("Hoeveel benzine mag ik thuis bewaren?", "In een woning of gewone garage hoogstens 25 liter, in een gesloten kan.")],
    [("Belastingdienst / Douane", "https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/douane_voor_particulieren/"), ("ANWB", "https://www.anwb.nl/auto/brandstof")])
artikel("accijns-benzine-diesel-2026", "Accijns op benzine en diesel in 2026: zoveel betaal je per liter", "Accijns op benzine en diesel 2026",
    "Op een liter benzine zit in 2026 € 0,8447 accijns, op diesel € 0,5523, plus 21% btw. Daarom is tanken over de grens zoveel goedkoper.",
    "In 2026 betaal je in Nederland € 0,8447 accijns per liter benzine en € 0,5523 per liter diesel. Daarbovenop komt 21 procent btw, ook over de accijns. Daardoor is tanken in België en Duitsland goedkoper.",
    '''<h2>Accijns per liter (vanaf 1 januari 2026)</h2><div class="tw"><table class="pt"><tbody><tr><td>Benzine (Euro95, E10, E5)</td><td class="p">€ 0,8447</td></tr><tr><td>Diesel</td><td class="p">€ 0,5523</td></tr><tr><td>LPG</td><td class="p">€ 0,1993</td></tr></tbody></table></div>
<h2>Btw over de accijns</h2><p>Over de prijs inclusief accijns betaal je 21 procent btw. Alleen al aan accijns en de btw daarover kost een liter benzine dus ruim een euro.</p>
<h2>Tijdelijke korting en wat er komt</h2><p>Sinds 2022 geldt in Nederland een tijdelijke accijnskorting; die is ook voor 2026 verlengd en de jaarlijkse inflatiecorrectie is uitgesteld. Vanaf 2028 staat een Europese CO₂-heffing op brandstof gepland (ETS2), die de benzineprijs volgens de ANWB met zo'n 13 cent per liter kan verhogen.</p>
<h2>Waarom de grens loont</h2><p>België en Duitsland heffen minder belasting per liter. Duitsland heeft daarbij van 1 oktober tot en met 31 december 2026 de energiebelasting tijdelijk verlaagd.</p>''',
    [("Hoeveel accijns zit er op een liter benzine?", "In 2026 € 0,8447 per liter, plus 21 procent btw."), ("Hoeveel accijns zit er op diesel?", "In 2026 € 0,5523 per liter, plus 21 procent btw."),
     ("Betaal je btw over de accijns?", "Ja, de btw van 21 procent wordt berekend over de prijs inclusief accijns.")],
    [("ANWB", "https://www.anwb.nl/auto/brandstof"), ("Rijksoverheid", "https://www.rijksoverheid.nl/onderwerpen/belastingen-op-auto-en-motor")])
artikel("goedkoop-tanken-tips", "Goedkoop tanken: 8 tips die echt schelen", "Goedkoop tanken: 8 tips",
    "Tank over de grens, vóór 12 uur in Duitsland, niet aan de snelweg en kies E10. Acht tips om flink op brandstof te besparen.",
    "Het goedkoopst tank je meestal net over de grens: benzine in België, diesel in België of Duitsland. Tank in Duitsland vlak vóór 12 uur, mijd de snelweg en kies onbemande stations.",
    '''<ol class="tips"><li><b>Tank over de grens.</b> Benzine is in België en Duitsland vaak 30 cent of meer per liter goedkoper.</li>
<li><b>Reken de rit mee.</b> Omrijden kost ook brandstof. Tankwijzer rekent je netto besparing uit vanaf je eigen locatie.</li>
<li><b>Duitsland: tank vóór 12 uur.</b> Om 12 uur mogen de prijzen omhoog.</li>
<li><b>Mijd de snelweg.</b> Snelwegstations zijn in alle drie de landen het duurst.</li>
<li><b>Kies onbemand.</b> Onbemande stations zijn meestal goedkoper.</li>
<li><b>België: kijk naar morgen.</b> Gaat de maximumprijs morgen omhoog, tank dan vandaag.</li>
<li><b>Kies E10 als het kan.</b> E10 is meestal goedkoper dan E5 of Super 98. Controleer of je auto het kan.</li>
<li><b>Rijd zuinig.</b> Op tijd schakelen, banden op spanning en rustig rijden schelen al snel 10 procent.</li></ol>''',
    [("Waar tank je het goedkoopst?", "Meestal net over de grens: benzine in België, diesel in België of Duitsland."),
     ("Wanneer tank je in Duitsland het goedkoopst?", "Vlak vóór 12:00 uur."), ("Is E10 goedkoper dan E5?", "Meestal wel. Controleer wel of je auto E10 mag tanken.")],
    [("ADAC", "https://www.adac.de/verkehr/tanken-kraftstoff-antrieb/"), ("ANWB", "https://www.anwb.nl/auto/brandstof")])

# ---------- over en privacy ----------
over = '''<div class="panel"><h2>Ik verdien er niets aan</h2><p>Tankwijzer is een hobbyproject van Erik. Er staat geen reclame op, tankstations kunnen geen plek kopen en er zitten geen commissielinks in. De volgorde is altijd: goedkoopste eerst.</p></div>
<h2>Waar komen de prijzen vandaan?</h2><ul><li><b>Duitsland:</b> live van de Markttransparenzstelle für Kraftstoffe, via Tankerkönig (CC BY 4.0). Elk Duits tankstation moet een prijswijziging binnen minuten melden.</li>
<li><b>België:</b> de officiële maximumprijs (FOD Economie) en de laagste prijs per provincie, via carbu.com. Daarnaast het weekgemiddelde uit het EU Oil Bulletin.</li>
<li><b>Nederland:</b> het daggemiddelde van het CBS, bijgewerkt met de verandering van de landelijke adviesprijs (UnitedConsumers) sinds die dag.</li>
<li><b>Tankstations en plaatsen:</b> © OpenStreetMap-bijdragers.</li></ul>
<p>De prijs aan de pomp is altijd leidend.</p>
<h2>Privacy</h2><p>Tankwijzer gebruikt geen cookies en je hebt geen account nodig. Je instellingen, favorieten en tankbeurten blijven alleen op je eigen telefoon of computer. Je locatie wordt alleen in je browser gebruikt om te rekenen en niet bewaard. Bezoeken tellen we met GoatCounter, zonder cookies en zonder persoonsgegevens.</p>
<h2>Contact</h2><p>Een fout gezien of een idee? Mail naar <a href="mailto:erik@beltman.email">erik@beltman.email</a>.</p>'''
schrijf("/gids/over.html", pagina("/gids/over.html", "Over Tankwijzer: gratis, zonder reclame en zonder cookies", "Waar de prijzen vandaan komen, hoe we rekenen en waarom Tankwijzer gratis is.", "Over Tankwijzer en privacy", over, None, [("Home", "/"), ("Over", None)]))
gemaakt.append(("/gids/over.html", "0.3"))

# ---------- gidsoverzicht ----------
gids = ('<p class="lead">Alles over goedkoop tanken in Nederland, België en Duitsland, met de prijzen van vandaag.</p><ul class="kaarten">' +
        '<li><a href="/gids/prijzen-vandaag.html"><b>Brandstofprijzen vandaag</b><span>NL, België en Duitsland naast elkaar</span></a></li><li><a href="/gids/grensplaatsen.html"><b>Alle grensplaatsen</b><span>Prijs en besparing per plaats</span></a></li>' +
        "".join(f'<li><a href="{p}"><b>{esc(k)}</b><span>{esc(o)}</span></a></li>' for p, k, o in ART) + "</ul><h2>Grensplaatsen</h2><ul class=\"links\">" +
        "".join(f'<li><a href="/gids/tanken-in-{pl[1]}.html">Tanken in {esc(pl[0])}</a></li>' for pl in PLAATSEN) + "</ul>")
schrijf("/gids/", pagina("/gids/", "Tankgids: goedkoop tanken in Nederland, België en Duitsland", "Prijzen van vandaag, alle grensplaatsen, de Duitse 12-uurregel, de Belgische maximumprijs, jerrycans en accijns.", "Tankgids", gids, None, [("Home", "/"), ("Tankgids", None)]))
gemaakt.append(("/gids/", "0.8"))

# ---------- startpagina: zoektekst, uitleg en gegevens voor Google ----------
app = open(os.path.join(OUT, "index.html")).read()
vr_home = [("Waar tank ik vandaag het goedkoopst?", kort_pv),
           ("Loont het om over de grens te tanken?", "Meestal wel als je binnen zo'n 20 tot 30 kilometer van de grens woont. Tankwijzer rekent je netto besparing uit, na aftrek van de rit, vanaf je eigen locatie en met het verbruik van je eigen auto."),
           ("Wanneer is tanken in Duitsland het goedkoopst?", "Vlak vóór 12:00 uur. Duitse stations mogen de prijs maar één keer per dag verhogen, om 12 uur."),
           ("Is Tankwijzer gratis?", "Ja. Er is geen reclame, geen account en geen verdienmodel. Ik verdien er geen cent aan.")]
fh, fl = faq(vr_home)
seo = (f'<section class="seo" aria-label="Uitleg"><div class="card"><h2>Waar tank je vandaag het goedkoopst?</h2><p>{esc(kort_pv)}</p>'
       '<p>Tankwijzer zet de live prijzen van Duitse grensstations, de Belgische maximum- en provincieprijzen en de Nederlandse pompprijs naast elkaar. '
       'Je ziet meteen wat je bespaart, ook na aftrek van de rit vanaf je eigen locatie. Navigeren gaat met één tik via Google Maps of Apple Kaarten, ook in je auto.</p>'
       '<ul class="gidslinks"><li><a href="/gids/prijzen-vandaag.html">Prijzen vandaag</a></li><li><a href="/gids/grensplaatsen.html">Grensplaatsen</a></li><li><a href="/gids/tanken-in-duitsland.html">Tanken in Duitsland</a></li><li><a href="/gids/tanken-in-belgie.html">Tanken in België</a></li><li><a href="/gids/jerrycan-brandstof-meenemen-grens.html">Jerrycan</a></li><li><a href="/gids/goedkoop-tanken-tips.html">8 tips</a></li></ul></div>'
       f'<div class="card">{fh}</div></section>')
ld_home = [{"@context": "https://schema.org", "@type": "WebApplication", "name": "Tankwijzer", "url": BASE + "/", "applicationCategory": "TravelApplication", "operatingSystem": "Alle (web-app)", "inLanguage": "nl",
            "description": "Live benzine- en dieselprijzen in Nederland, België en Duitsland, met je besparing na aftrek van de rit.", "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"}, "author": {"@type": "Person", "name": "Erik", "email": "erik@beltman.email"}},
           fl]
app = app.replace("{{LDJSON}}", json.dumps(ld_home, ensure_ascii=False)).replace("<!--SEO-->", seo)
open(os.path.join(OUT, "index.html"), "w").write(app)

# ---------- sitemap, robots, kopregels ----------
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + f"<url><loc>{BASE}/</loc><lastmod>{VANDAAG.isoformat()}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>\n" + "".join(
    f"<url><loc>{BASE}{p}</loc><lastmod>{VANDAAG.isoformat()}</lastmod><changefreq>daily</changefreq><priority>{pr}</priority></url>\n" for p, pr in gemaakt) + "</urlset>\n"
open(os.path.join(OUT, "sitemap.xml"), "w").write(sm)
open(os.path.join(OUT, "robots.txt"), "w").write(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n")
print(f"klaar: {len(gemaakt) + 1} pagina's in {OUT}")
