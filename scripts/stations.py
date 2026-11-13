"""Duitse grensstations voor de pagina's per tankstation.

Haalt via de eigen Tankerkönig-doorgeefroute van de live site (/api/tk/list.php) de stations rond de grenspunten op
(dezelfde punten als netlify/bronnen.mjs) en voegt ze samen met site/stations-basis.json.
Een station dat even niet terugkomt blijft 21 dagen staan, zodat pagina's niet steeds verdwijnen en terugkomen.

Los draaien (GitHub Action): python3 scripts/stations.py  -> werkt site/stations-basis.json bij.
In bouw.py: from stations import laad; laad() geeft de lijst zonder iets weg te schrijven.
"""
import json, os, re, sys, datetime, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASIS = os.path.join(ROOT, "site", "stations-basis.json")
BASE = "https://goedkopertanken.netlify.app"
BEWAAR_DAGEN = 21


def grenspunten():
    src = open(os.path.join(ROOT, "netlify", "bronnen.mjs")).read()
    blok = src[src.index("GRENS_DE"):]
    blok = blok[:blok.index("];")]
    return [(n, float(a), float(b)) for n, a, b in re.findall(r"\['([^']+)',\s*([\d.]+),\s*([\d.]+)\]", blok)]


def schoon(s):
    """Alleen de velden die we nodig hebben, als nette tekst."""
    def t(v): return re.sub(r"\s+", " ", str(v or "")).strip()
    return {"id": s["id"], "name": t(s.get("name")), "brand": t(s.get("brand")), "street": t(s.get("street")), "nr": t(s.get("houseNumber")),
            "pc": t(s.get("postCode")), "place": t(s.get("place")), "lat": round(float(s["lat"]), 6), "lng": round(float(s["lng"]), 6),
            "e5": s.get("e5") if isinstance(s.get("e5"), (int, float)) and s["e5"] > 0.5 else None,
            "e10": s.get("e10") if isinstance(s.get("e10"), (int, float)) and s["e10"] > 0.5 else None,
            "diesel": s.get("diesel") if isinstance(s.get("diesel"), (int, float)) and s["diesel"] > 0.5 else None}


def haal_live(log=print):
    nieuw = {}
    for naam, lat, lng in grenspunten():
        try:
            u = f"{BASE}/api/tk/list.php?lat={lat}&lng={lng}&rad=6&sort=dist&type=all"
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Tankwijzer-build"}), timeout=20) as r:
                j = json.loads(r.read().decode())
            if not j.get("ok"): raise ValueError(j.get("message") or "fout")
            for s in j.get("stations", []):
                if re.fullmatch(r"[0-9a-f-]{36}", str(s.get("id", ""))): nieuw[s["id"]] = schoon(s)
        except Exception as e:
            log(f"stations {naam} mislukt: {e}")
    return nieuw


def laad(live=True, log=print):
    try: basis = {s["id"]: s for s in json.load(open(BASIS))}
    except Exception: basis = {}
    vandaag = datetime.date.today().isoformat()
    nieuw = haal_live(log) if live else {}
    for i, s in nieuw.items():
        s["gezien"] = vandaag
        oud = basis.get(i, {})
        for f in ("e5", "e10", "diesel"):  # gesloten station zonder prijs: vorige prijs bewaren
            if s[f] is None and oud.get(f): s[f] = oud[f]
        basis[i] = s
    grens = (datetime.date.today() - datetime.timedelta(days=BEWAAR_DAGEN)).isoformat()
    lijst = [s for s in basis.values() if s.get("gezien", vandaag) >= grens]
    log(f"stations: {len(nieuw)} live, {len(lijst)} in totaal")
    return sorted(lijst, key=lambda s: s["id"])


if __name__ == "__main__":
    lijst = laad(True)
    if len(lijst) < 20: sys.exit("te weinig stations, niets opgeslagen")
    json.dump(lijst, open(BASIS, "w"), ensure_ascii=False, indent=0)
    print("opgeslagen:", BASIS)
