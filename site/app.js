"use strict";
/* Tankwijzer — zoeken, routeplanner, live Duitse prijzen (Tankerkönig), NL/BE/DE dagprijzen */
// Live Duitse prijzen lopen via onze eigen server (/api/tk/), zodat de Tankerkönig-sleutel nooit in de browser staat.
const API = "/api/tk/";
const PRICE_TTL = 5 * 60 * 1000, LIST_TTL = 12 * 60 * 60 * 1000, CBS_TTL = 3 * 60 * 60 * 1000, ROAD = 1.3;
const FUELNAME = { e10: "Euro95 / E10", diesel: "Diesel", e5: "Super E5 / 98", lpg: "LPG" };
const HWY = /\b(BAB|Autobahn|Rastst(ä|ae)tte|Tank\s*(&|und)\s*Rast|Serways)\b/i;
const CBS_FALLBACK = [
  ["20260920",2.449,2.572],["20260921",2.449,2.579],["20260922",2.443,2.562],["20260923",2.441,2.543],["20260924",2.444,2.539],
  ["20260925",2.459,2.536],["20260926",2.462,2.522],["20260927",2.463,2.522],["20260928",2.465,2.526],["20261001",2.437,2.518],
  ["20261002",2.433,2.519],["20261003",2.428,2.502],["20261004",2.427,2.499],["20261005",2.432,2.506],["20261006",2.432,2.496],
  ["20261007",2.434,2.472],["20261008",2.450,2.476],["20261009",2.455,2.482],["20261010",2.457,2.477],["20261011",2.457,2.477],
  ["20261012",2.462,2.482]
];
const DATA_FALLBACK = {"updated":"2026-10-16T21:40:00+02:00","nl":{"advies":{"e10":2.684,"diesel":2.703,"e5":2.904,"date":"20261016","src":"UnitedConsumers landelijke adviesprijs"},"adviesHist":[["20260928",2.73,2.785],["20261016",2.684,2.703]]},"be":{"max":{"e10":2.064,"e5":2.201,"diesel":2.428,"date":"20261016","src":"officiële maximumprijs (FOD Economie)"},"next":{"e10":2.064,"e5":2.201,"diesel":2.444,"date":"20261017"},"avg":{"e10":1.977,"diesel":2.335,"date":"20261012","src":"EU Weekly Oil Bulletin, gemiddelde pompprijs"},"low":{"e10":1.856,"e5":2.041,"diesel":2.233,"date":"20261016","where":{"e10":"Luik","e5":"Limburg","diesel":"Limburg"},"src":"laagste prijs grensprovincies (Antwerpen, Limburg, Luik)"},"prov":{"date":"20261016","Antwerpen":{"e10":1.869,"e5":2.091,"diesel":2.235},"Limburg":{"e10":1.876,"e5":2.041,"diesel":2.233},"Luik":{"e10":1.856,"e5":2.094,"diesel":2.248},"Oost-Vlaanderen":{"e10":1.864,"e5":2.001,"diesel":2.228}}},"de":{"avg":{"e10":2.126,"diesel":2.233,"date":"20261007","src":"ADAC-gemiddelde Duitsland"},"border":{"e10":2.129,"diesel":2.248,"date":"20261016","src":"goedkoopste grensstation (Markttransparenzstelle)"},"nrw":{"e10":2.122,"date":"20261016","src":"gemiddelde Noordrijn-Westfalen"}},"history":{"deAvg":[["20260916",2.314,null],["20260917",null,2.471],["20260930",2.258,2.409],["20261007",2.126,2.233]],"deBorder":[["20261015",2.059,2.189],["20261016",2.129,2.248]],"beMax":[["20260916",2.058,2.468],["20261009",2.065,2.392],["20261016",2.064,2.428],["20261017",2.064,2.444]],"beAvg":[["20260914",1.976,2.29],["20260921",1.988,2.387],["20260928",2.032,2.43],["20261005",1.959,2.349],["20261012",1.977,2.335]]}};
const CARS = [
  ["Gemiddelde auto",7.5,50],["Citroën C3 1.2",5.4,45],["Dacia Sandero TCe 90",5.6,50],["Ford Fiesta 1.0 EcoBoost",5.4,42],["Ford Focus 1.0 EcoBoost",5.9,52],
  ["Hyundai i10 1.0",5.0,36],["Hyundai i30 1.0 T-GDi",6.0,50],["Kia Picanto 1.0",5.0,35],["Kia Ceed 1.0 T-GDi",6.0,50],["Kia Sportage 1.6 T-GDi",7.2,54],
  ["Opel Corsa 1.2",5.5,44],["Opel Astra 1.2",5.8,52],["Peugeot 208 1.2",5.5,44],["Peugeot 308 1.2",5.8,52],["Renault Clio TCe 90",5.5,42],
  ["Renault Captur TCe",6.0,48],["Skoda Fabia 1.0 TSI",5.3,40],["Skoda Octavia 1.5 TSI",5.9,45],["Suzuki Swift 1.2",4.7,37],["Toyota Aygo X 1.0",4.9,35],
  ["Toyota Yaris Hybrid",4.0,36],["Toyota Corolla Hybrid",4.5,43],["Volkswagen Polo 1.0 TSI",5.4,40],["Volkswagen Golf 1.5 TSI",5.8,50],["Volkswagen Tiguan 1.5 TSI",7.0,58],
  ["Audi A3 35 TFSI",6.0,50],["BMW 320i",6.8,59],["Mercedes C 200",7.0,66],["Volvo XC40 B4",7.5,54],["Mazda CX-5 2.0",7.0,56],
  ["Skoda Octavia 2.0 TDI (diesel)",4.8,45],["Peugeot 308 1.5 BlueHDi (diesel)",4.7,52],["Volkswagen Passat 2.0 TDI (diesel)",5.2,66],
  ["Volkswagen Transporter 2.0 TDI (diesel)",8.0,70],["Ford Transit Custom 2.0 (diesel)",8.0,70],["Mercedes Sprinter (diesel)",9.5,71]
];
const BE_PROV = { Zelzate: "Oost-Vlaanderen", Putte: "Antwerpen", Essen: "Antwerpen", "Meer (Hazeldonk)": "Antwerpen", Poppel: "Antwerpen", Lommel: "Limburg", Hamont: "Limburg", Maaseik: "Limburg", Lanaken: "Limburg", "Visé": "Luik" };
const BE_CROSS = [["Zelzate",51.20,3.81],["Putte",51.40,4.38],["Essen",51.47,4.45],["Meer (Hazeldonk)",51.50,4.75],["Poppel",51.45,5.05],
  ["Lommel",51.25,5.31],["Hamont",51.25,5.55],["Maaseik",51.10,5.79],["Lanaken",50.89,5.65],["Visé",50.77,5.70]];
const CITIES = [
  ["Groningen",53.219,6.567],["Winschoten",53.144,7.035],["Emmen",52.785,6.897],["Coevorden",52.661,6.741],["Hardenberg",52.575,6.619],
  ["Zwolle",52.516,6.083],["Almelo",52.357,6.663],["Oldenzaal",52.313,6.929],["Hengelo",52.266,6.793],["Enschede",52.221,6.893],
  ["Winterswijk",51.972,6.719],["Doetinchem",51.965,6.289],["Apeldoorn",52.211,5.969],["Arnhem",51.985,5.899],["Zevenaar",51.930,6.071],
  ["Nijmegen",51.842,5.853],["Venlo",51.370,6.172],["Roermond",51.194,5.987],["Sittard",51.000,5.869],["Heerlen",50.888,5.980],
  ["Kerkrade",50.866,6.063],["Maastricht",50.851,5.690],["Eindhoven",51.441,5.478],["Utrecht",52.090,5.120],["Amsterdam",52.370,4.900],["Rotterdam",51.920,4.480]
];
// ---------- bezoekersstatistiek (GoatCounter, zonder cookies; alleen gebeurtenissen, geen persoonsgegevens) ----------
const gcq = [];
function gc(path, title) { gcq.push({ path: String(path).slice(0, 200), title: title || path, event: true }); gcFlush(); }
function gcFlush() { if (!window.goatcounter || !goatcounter.count) { if (!gcFlush.t) gcFlush.t = setTimeout(() => { gcFlush.t = 0; gcFlush(); }, 1500); return; } while (gcq.length) try { goatcounter.count(gcq.shift()); } catch (e) {} }
// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const fmt = (n, d = 3) => (n == null || isNaN(n)) ? "–" : n.toLocaleString("nl-NL", { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = (n) => (n < 0 ? "− " : "") + "€ " + Math.abs(n).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hhmm = (ts) => new Date(ts).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
const ymd = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
const todayKey = () => ymd(new Date());
const dayLabel = (k) => new Date(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
const num = (v) => (typeof v === "number" && v > 0.5) ? v : null;
const town = (s) => (s.place || "").replace(/^\d+\s*/, "");
const navBtns = (s) => `<a class="big g" href="${nav.google(s)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg><span class="bl"><b>Google Maps</b><small>Android Auto · CarPlay</small></span></a><a class="big a" href="${nav.apple(s)}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg><span class="bl"><b>Apple Kaarten</b><small>CarPlay</small></span></a>`;
const nav = {
  google: (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving&dir_action=navigate`,
  waze: (s) => `https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes`,
  apple: (s) => `https://maps.apple.com/?saddr=Current%20Location&daddr=${s.lat},${s.lng}&dirflg=d`
};
async function getJSON(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { ...opts, signal: ctrl.signal, cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}

// Navigatie-apps direct openen (app zelf), met de website als terugval als de app niet geïnstalleerd is
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href]"); if (!a) return;
  const href = a.href; let app = null;
  if (/google\.com\/maps|maps\.apple\.com|waze\.com/.test(href)) gc("navigatie/" + (href.includes("google") ? "google" : "apple"), "Route gestart");
  if (href.includes("waze.com/ul")) app = "waze://?" + href.split("?")[1];
  else if (href.includes("maps.apple.com") && IOS) app = "maps://?" + href.split("?")[1];
  if (!app) return;
  e.preventDefault();
  let left = false; const mark = () => { left = true; };
  document.addEventListener("visibilitychange", mark, { once: true }); window.addEventListener("pagehide", mark, { once: true });
  location.href = app;
  setTimeout(() => { if (!left && document.visibilityState === "visible") window.open(href, "_blank"); }, 1500);
}, true);

// ---------- state ----------
const S = {
  fuel: store.get("tw_fuel", "e10"), region: store.get("tw_region", "gelderland"), key: "server",
  sort: store.get("tw_sort2", "price"), brand: "", openOnly: store.get("tw_open", true), noHwy: store.get("tw_nohwy", true), favOnly: false,
  favs: new Set(store.get("tw_favs", [])), home: store.get("tw_gps", null), locTs: 0, locDenied: false,
  nlOwn: store.get("tw_nlOwn", {}), cache: store.get("tw_cache", {}), hist: store.get("tw_hist", {}), cbs: store.get("tw_cbs", null),
  fills: store.get("tw_fills", []), alert: store.get("tw_alert", {}), alertLast: store.get("tw_alertLast", {}),
  data: store.get("tw_data", null) || DATA_FALLBACK, theme: store.get("tw_theme", "system"),
  mode: "border", place: null, found: [], searching: false, searchErr: "", open: null, details: {},
  route: null, busy: false, error: "", tab: "zoek"
};
if (!FUELNAME[S.fuel]) S.fuel = "e10";
if (!REGIONS[S.region]) S.region = "gelderland";
const settings = () => { const tank = +$("cTank").value || 50, lvl = +$("cLvl").value || 0; return { L: Math.max(1, Math.round(tank * (1 - lvl / 100))), use: +$("cUse").value || 6.5, freq: +$("cFreq").value || 2, tank }; };

// ---------- Tankerkönig ----------
async function tk(path, params) {
  let j;
  try { j = await getJSON(API + path + "?" + new URLSearchParams(params)); }
  catch (e) { throw new Error(navigator.onLine ? "Tankerkönig is even niet bereikbaar." : "Geen internetverbinding."); }
  if (!j.ok) throw new Error(j.message || "Live Duitse prijzen zijn even niet beschikbaar.");
  return j;
}
function toStation(s) {
  return { id: s.id, src: "tk", cc: "DE", name: s.name || "", brand: (s.brand || "").trim(), street: [s.street, s.houseNumber].filter(Boolean).join(" "),
    place: [s.postCode, s.place].filter(Boolean).join(" "), lat: s.lat, lng: s.lng, e5: num(s.e5), e10: num(s.e10), diesel: num(s.diesel),
    isOpen: !!s.isOpen, hwy: HWY.test(s.name || "") || HWY.test(s.street || ""), border: borderDistance(s.lat, s.lng) };
}
async function scanRegion(region) {
  const byId = new Map();
  for (const [lat, lng] of REGIONS[region].pts) {
    const j = await tk("list.php", { lat, lng, rad: 12, sort: "dist", type: "all" });
    for (const raw of j.stations || []) { if (byId.has(raw.id)) continue; const st = toStation(raw); if (st.border <= 10.5) byId.set(raw.id, st); }
    await new Promise((r) => setTimeout(r, 250));
  }
  S.cache[region] = { listTs: Date.now(), priceTs: Date.now(), stations: [...byId.values()] };
}
async function refreshPrices(list) {
  const map = new Map(list.filter((s) => s.src === "tk").map((s) => [s.id, s])), ids = [...map.keys()];
  for (let i = 0; i < ids.length; i += 10) {
    const j = await tk("prices.php", { ids: ids.slice(i, i + 10).join(",") });
    for (const [id, p] of Object.entries(j.prices || {})) { const s = map.get(id); if (s) { s.isOpen = p.status === "open"; s.e5 = num(p.e5); s.e10 = num(p.e10); s.diesel = num(p.diesel); } }
  }
}
function recordDay(region) {
  const c = S.cache[region]; if (!c) return;
  const k = todayKey(); S.hist[k] = S.hist[k] || {}; const day = (S.hist[k][region] = S.hist[k][region] || {});
  for (const f of ["e10", "diesel", "e5"]) {
    const ps = c.stations.filter((s) => s.isOpen && s[f] && !s.hwy).map((s) => s[f]); if (!ps.length) continue;
    const avg = ps.reduce((a, b) => a + b, 0) / ps.length, cur = day[f] || [0, 0]; day[f] = [cur[0] + avg, cur[1] + 1];
  }
  const keys = Object.keys(S.hist).sort(); while (keys.length > 120) delete S.hist[keys.shift()];
  store.set("tw_hist", S.hist);
}
async function update(force = false) {
  if (!S.key || S.busy) { render(); return; }
  const c = S.cache[S.region], now = Date.now();
  const needList = force === "list" || !c || now - c.listTs > LIST_TTL, needPrices = force || !c || now - c.priceTs > PRICE_TTL;
  if (!needList && !needPrices) { render(); return; }
  S.busy = true; S.error = ""; render();
  try {
    if (needList) await scanRegion(S.region); else { await refreshPrices(c.stations); c.priceTs = Date.now(); }
    recordDay(S.region); store.set("tw_cache", S.cache); checkAlert();
    if (S.mode === "search" && S.place && S.found.some((s) => s.src === "tk")) { await refreshPrices(S.found); S.place.ts = Date.now(); }
  } catch (e) { S.error = e.message; }
  S.busy = false; render();
}
async function loadDetail(id) {
  if (S.details[id]) return;
  try { S.details[id] = (await tk("detail.php", { id })).station || {}; } catch (e) { S.details[id] = { error: e.message }; }
  render();
}

// ---------- plaatsen zoeken + stations ----------
async function geocode(q) {
  try {
    const j = await getJSON("https://photon.komoot.io/api/?" + new URLSearchParams({ q, limit: 6, lang: "de", bbox: "2.5,49.4,9.6,54.0" }), {}, 10000);
    const out = (j.features || []).filter((f) => ["NL", "DE", "BE"].includes((f.properties.countrycode || "").toUpperCase()))
      .map((f) => ({ name: [f.properties.name, f.properties.city !== f.properties.name ? f.properties.city : ""].filter(Boolean).join(", "), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], cc: f.properties.countrycode.toUpperCase() }));
    if (out.length) return out;
  } catch (e) {}
  const j = await getJSON("https://nominatim.openstreetmap.org/search?" + new URLSearchParams({ format: "jsonv2", q, countrycodes: "nl,de,be", limit: 5, addressdetails: 1 }), {}, 10000);
  return j.map((r) => ({ name: r.display_name.split(",").slice(0, 2).join(","), lat: +r.lat, lng: +r.lon, cc: (r.address?.country_code || "").toUpperCase() }));
}
async function reverseCC(lat, lng) {
  try { const j = await getJSON(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`, {}, 8000); const p = j.features?.[0]?.properties || {}; return { cc: (p.countrycode || "").toUpperCase(), name: p.city || p.name || "Mijn locatie" }; }
  catch (e) { return { cc: "", name: "Mijn locatie" }; }
}
async function osmStations(lat, lng, radius) {
  const q = `[out:json][timeout:20];nwr["amenity"="fuel"](around:${radius},${lat},${lng});out center tags;`;
  const j = await getJSON("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } }, 25000);
  return (j.elements || []).map((e) => {
    const t = e.tags || {}, la = e.lat ?? e.center?.lat, ln = e.lon ?? e.center?.lon;
    return { id: "osm" + e.id, src: "osm", cc: (t["addr:country"] || "").toUpperCase(), name: t.name || "", brand: t.brand || t.operator || t.name || "Tankstation",
      street: [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" "), place: t["addr:city"] || "", lat: la, lng: ln,
      e5: null, e10: null, diesel: null, isOpen: true, hwy: /motorway|snelweg|autobahn|A\d+/i.test(t.name || "") && t["highway"] !== undefined,
      unmanned: t.automated === "yes" || t.self_service === "only" || /onbemand|tankautomat/i.test(t.name || ""), border: null };
  }).filter((s) => s.lat && s.lng);
}
// Na zoeken direct naar de lijst met tankstations scrollen (en het toetsenbord sluiten).
function naarLijst() { try { document.activeElement?.blur(); } catch (e) {} requestAnimationFrame(() => document.querySelector(".reshead")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })); }
async function searchPlace(place) {
  S.mode = "search"; S.place = { ...place, ts: Date.now() }; S.found = []; S.searching = true; S.searchErr = ""; S.open = null; render();
  try {
    const tasks = [];
    // Duitse stations met prijs (Tankerkönig): in Duitsland rond de plaats, vanuit NL/BE tot 20 km over de grens
    if (S.key) tasks.push(tk("list.php", { lat: place.lat.toFixed(4), lng: place.lng.toFixed(4), rad: place.cc === "DE" ? 6 : 20, sort: "dist", type: "all" }).then((j) => (j.stations || []).map(toStation)));
    // Stationslocaties zonder prijs (OpenStreetMap) in NL/BE, of in DE zonder sleutel
    if (place.cc !== "DE" || !S.key) tasks.push(osmStations(place.lat, place.lng, 6000).then((l) => l.map((s) => ({ ...s, cc: s.cc || place.cc || "NL" }))));
    const res = await Promise.allSettled(tasks);
    let list = res.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
    if (S.key) list = list.filter((s) => !(s.src === "osm" && s.cc === "DE"));
    list.forEach((s) => { s.dist = haversine([place.lat, place.lng], [s.lat, s.lng]); });
    S.found = list.filter((s) => s.src === "tk" || s.dist <= 6);
    await Promise.all([googleErbij(place, S.found), meldingenErbij(place, S.found)]);
    const fails = res.filter((r) => r.status === "rejected");
    if (fails.length && !S.found.length) S.searchErr = "Zoeken lukte niet. Controleer je internet en probeer opnieuw.";
  } catch (e) { S.searchErr = "Zoeken lukte niet. Probeer het opnieuw."; }
  S.searching = false; render(); naarLijst();
}
// Pompprijzen per station in NL/BE via Google (onze server bewaart ze 12 uur per gebied, zodat het gratis blijft).
async function googleErbij(place, list) {
  if (!place.lat || place.cc === "DE") return;
  try {
    const j = await getJSON(`/api/nl-prijzen?lat=${place.lat.toFixed(1)}&lng=${place.lng.toFixed(1)}`, {}, 14000);
    for (const g of j.stations || []) {
      let st = list.find((x) => x.src === "osm" && haversine([x.lat, x.lng], [g.lat, g.lng]) < 0.12);
      if (!st) { st = { id: g.id, src: "osm", cc: place.cc || "NL", name: g.naam, brand: g.naam, street: g.adres, place: "", lat: g.lat, lng: g.lng, e5: null, e10: null, diesel: null, isOpen: true, hwy: false, border: null, dist: haversine([place.lat, place.lng], [g.lat, g.lng]) }; if (st.dist > 7) continue; list.push(st); }
      st.gp = g.prijzen;
      for (const [f, x] of Object.entries(g.prijzen)) if (!st.meld?.[f] || st.meld[f].t < x.t) { st[f] = x.p; st.bron = { ...(st.bron || {}), [f]: "google" }; }
    }
  } catch (e) {}
}
// Prijzen die bezoekers zelf gemeld hebben (NL/BE, hoogstens 48 uur oud) bij de stations zetten.
async function meldingenErbij(place, list) {
  if (!place.lat || !list.some((s) => s.src === "osm")) return;
  try {
    const j = await getJSON(`/api/melding?lat=${place.lat.toFixed(1)}&lng=${place.lng.toFixed(1)}`, {}, 8000);
    const by = new Map((j.stations || []).map((m) => [m.id, m]));
    for (const st of list) { const m = by.get(st.id); if (!m) continue; st.meld = m.prijzen; for (const [f, x] of Object.entries(m.prijzen)) if (!st.gp?.[f] || st.gp[f].t < x.t) { st[f] = x.p; st.bron = { ...(st.bron || {}), [f]: "melding" }; } }
  } catch (e) {}
}
const geleden = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? `${Math.max(1, m)} min geleden` : m < 1440 ? `${Math.round(m / 60)} uur geleden` : m < 2880 ? "gisteren" : `${Math.round(m / 1440)} dagen geleden`; };
async function meldPrijs(id) {
  const st = S.found.find((x) => x.id === id); if (!st) return;
  const v = prompt(`Wat kost ${FUELNAME[S.fuel]} bij ${st.brand || st.name || "dit station"}? Bijvoorbeeld 2,349`, st.meld?.[S.fuel] ? fmt(st.meld[S.fuel].p) : "");
  if (v == null) return;
  const p = parseFloat(String(v).replace(",", "."));
  if (!(p > 0.3 && p < 4)) { alert("Vul een prijs in zoals 2,349."); return; }
  try {
    const r = await fetch("/api/melding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: st.id, naam: [st.brand || st.name, st.street, town(st)].filter(Boolean).join(", "), lat: st.lat, lng: st.lng, cc: st.cc, fuel: S.fuel, prijs: p }) });
    const j = await r.json();
    if (!r.ok) { alert(j.fout || "Melden lukte niet."); return; }
    st.meld = { ...(st.meld || {}), [S.fuel]: { p, t: Date.now() } }; st[S.fuel] = p; st.bron = { ...(st.bron || {}), [S.fuel]: "melding" }; gc("melding/" + st.cc, "Prijs gemeld"); render();
  } catch (e) { alert("Melden lukte niet. Controleer je internet."); }
}
async function doSearch(q) {
  q = q.trim(); if (!q) return;
  S.searching = true; S.mode = "search"; S.place = { name: q }; S.found = []; S.searchErr = ""; render(); naarLijst();
  try {
    const hits = await geocode(q);
    if (!hits.length) { S.searching = false; S.searchErr = `Geen plaats gevonden voor "${q}".`; render(); return; }
    S.alts = hits.slice(1, 5);
    store.set("tw_lastq", q); gc("zoek/" + q.toLowerCase(), "Zoekt: " + q);
    await searchPlace(hits[0]);
  } catch (e) { S.searching = false; S.searchErr = "Zoeken lukte niet. Controleer je internet."; render(); }
}

// ---------- CBS + data.json ----------
async function loadCBS() {
  if (S.cbs && Date.now() - S.cbs.ts < CBS_TTL) return;
  const k = ymd(new Date(Date.now() - 75 * 864e5));
  try {
    const j = await getJSON("https://opendata.cbs.nl/ODataApi/odata/80416ned/TypedDataSet?$filter=" + encodeURIComponent(`Perioden ge '${k}'`) + "&$select=Perioden,BenzineEuro95_1,Diesel_2,Lpg_3");
    const rows = (j.value || []).filter((r) => r.BenzineEuro95_1).map((r) => [r.Perioden, r.BenzineEuro95_1, r.Diesel_2, r.Lpg_3]).sort((a, b) => a[0].localeCompare(b[0]));
    if (rows.length) { S.cbs = { ts: Date.now(), rows }; store.set("tw_cbs", S.cbs); }
  } catch (e) {}
  render();
}
const DATA_URLS = ["/data.json", "https://raw.githubusercontent.com/djbeltman35-arch/Tankwijzer/main/site/data-basis.json"];
async function loadData() {
  const got = await Promise.allSettled(DATA_URLS.map((u) => getJSON(u + "?t=" + Math.floor(Date.now() / 300000), {}, 10000)));
  for (const r of got) { const j = r.value; if (r.status === "fulfilled" && j?.updated && (!S.data.updated || j.updated > S.data.updated)) { S.data = j; store.set("tw_data", j); } }
  render();
}
const cbsRows = () => (S.cbs?.rows?.length ? S.cbs.rows : CBS_FALLBACK);
function cbsOn(k, f) { const i = f === "diesel" ? 2 : 1, rows = cbsRows(); let b = rows[0]; for (const r of rows) if (r[0] <= k) b = r; return b[i]; }
const beMax = (f = S.fuel) => S.data.be?.max?.[f] ?? null;
const beAvg = (f = S.fuel) => S.data.be?.avg?.[f] ?? beMax(f);
const beLow = (f = S.fuel) => S.data.be?.low?.[f] ?? beAvg(f);
const deBorder = (f = S.fuel) => S.data.de?.border?.[f] ?? null;
function nlPrice(f = S.fuel) {
  if (S.nlOwn[f]) return { p: S.nlOwn[f], src: "Eigen prijs" };
  if (f === "e5") { const a = S.data.nl?.advies; return { p: a?.e5 ?? 2.904, src: "Advies · " + dayLabel(a?.date || "20261016") }; }
  if (f === "lpg") { const r = [...cbsRows()].reverse().find((x) => x[3]); if (r) return { p: r[3], src: "Gem. · " + dayLabel(r[0]) }; const a = S.data.nl?.advies; return { p: a?.lpg ?? null, src: "Advies · " + dayLabel(a?.date || "20261016") }; }
  const rows = cbsRows(), last = rows[rows.length - 1], prev = rows[rows.length - 2], i = f === "e10" ? 1 : 2;
  const ah = S.data.nl?.adviesHist || [], a0 = ah.find((r) => r[0] === last[0]), a1 = ah[ah.length - 1];
  if (a0 && a1 && a1[0] > last[0] && a0[i] && a1[i]) return { p: last[i] + (a1[i] - a0[i]), src: `Schatting · ${dayLabel(a1[0])}` };
  const d = prev ? Math.round((last[i] - prev[i]) * 1000) / 10 : null;
  return { p: last[i], src: `Gem. · ${dayLabel(last[0])}${d ? ` · ${d > 0 ? "+" : "−"}${fmt(Math.abs(d), 1)}` : ""}` };
}
const refPrice = (cc) => cc === "BE" ? (S.fuel === "lpg" ? beLow() : beAvg()) : cc === "DE" ? (S.data.de?.avg?.[S.fuel] ?? deBorder()) : nlPrice().p;

// ---------- berekeningen ----------
function tripKm(s) { return S.home ? haversine([S.home.lat, S.home.lng], [s.lat, s.lng]) * 2 * ROAD : null; }
function netSave(s, km = tripKm(s)) { const p = s[S.fuel]; if (!p) return null; const { L, use } = settings(); return (nlPrice().p - p) * L - (km ?? 0) * use / 100 * p; }
function median(a) { if (!a.length) return null; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
function classOf(p, med) { if (p == null || med == null) return "off"; return p <= med - 0.03 ? "good" : p >= med + 0.03 ? "bad" : "mid"; }
const CLS = { good: "Goedkoop", mid: "Gemiddeld", bad: "Duur", off: "Geen prijs" };
function baseList() { return S.mode === "search" ? S.found : (S.cache[S.region]?.stations || []); }
function visible() {
  return baseList().filter((s) => (!S.openOnly || s.isOpen) && (!S.noHwy || !s.hwy) && (!S.brand || (s.brand || s.name) === S.brand) && (!S.favOnly || S.favs.has(s.id)));
}
function sortList(l) {
  const f = S.fuel, P = (s) => s[f] ?? 99;
  const by = { price: (a, b) => P(a) - P(b) || (a.dist ?? 0) - (b.dist ?? 0), dist: (a, b) => (a.dist ?? tripKm(a) ?? 0) - (b.dist ?? tripKm(b) ?? 0), net: (a, b) => (netSave(b) ?? -1e9) - (netSave(a) ?? -1e9) }[S.sort];
  return [...l].sort(by);
}
function bestDE() { const l = (S.cache[S.region]?.stations || []).filter((s) => s.isOpen && s[S.fuel] && !s.hwy); return l.sort((a, b) => (netSave(b) ?? -1e9) - (netSave(a) ?? -1e9))[0] || null; }

// ---------- prijsalarm ----------
function checkAlert() {
  for (const f of ["e10", "diesel", "e5"]) {
    const target = S.alert[f], c = S.cache[S.region]; if (!target || !c) continue;
    const hit = c.stations.filter((s) => s.isOpen && s[f] && !s.hwy && s[f] <= target).sort((a, b) => a[f] - b[f])[0]; if (!hit) continue;
    const msg = `${FUELNAME[f]} ${fmt(hit[f])} bij ${hit.brand || hit.name}, ${town(hit)}`; S.alertHit = msg;
    if (Date.now() - (S.alertLast[f] || 0) > 3 * 3600e3) {
      S.alertLast[f] = Date.now(); store.set("tw_alertLast", S.alertLast);
      try { if ("Notification" in window && Notification.permission === "granted") navigator.serviceWorker?.ready.then((r) => r.showNotification("Prijsalarm", { body: msg, icon: "icon-192.png", tag: "tw-" + f })); } catch (e) {}
    }
  }
}

// ---------- render ----------
function render() {
  const c = S.cache[S.region], st = $("status");
  if (S.busy || S.searching) { st.className = "status"; $("statusTxt").textContent = "Bezig…"; }
  else if (!S.key) { st.className = "status"; $("statusTxt").textContent = "Dagprijzen"; }
  else if (S.error) { st.className = "status err"; $("statusTxt").textContent = "Offline"; }
  else if (c) { const fresh = Date.now() - c.priceTs < 15 * 60000; st.className = "status " + (fresh ? "live" : "stale"); $("statusTxt").textContent = "Live " + hhmm(c.priceTs); }
  const ab = $("alertBanner"); ab.hidden = !S.alertHit; if (S.alertHit) ab.innerHTML = `<strong>🔔 ${esc(S.alertHit)}</strong>`;

  const nl = nlPrice(), be = beAvg(), beL = beLow(), regionCheap = (c?.stations || []).filter((s) => s.isOpen && s[S.fuel] && !s.hwy).sort((a, b) => a[S.fuel] - b[S.fuel])[0];
  const deP = regionCheap ? regionCheap[S.fuel] : deBorder();
  $("ledNL").innerHTML = fmt(nl.p) + "<small>€</small>"; $("srcNL").textContent = nl.src;
  $("ledBE").innerHTML = fmt(be) + "<small>€</small>"; const bn = S.data.be?.next, mx = beMax(); const bt = bn && bn.date > S.data.be.max.date && bn[S.fuel] && mx ? bn[S.fuel] - mx : null;
  $("srcBE").textContent = be ? (S.data.be.avg?.[S.fuel] ? `Gem. ${dayLabel(S.data.be.avg.date)} · max ${fmt(mx)}` : `Max · ${dayLabel(S.data.be.max.date)}`) + (bt ? ` · morgen ${bt > 0 ? "↑" : "↓"}${fmt(Math.abs(bt) * 100, 1)}ct` : "") : "–";
  if (S.fuel === "lpg") { $("ledDE").innerHTML = "–"; $("srcDE").textContent = "Geen live LPG-prijzen"; } else {
  $("ledDE").innerHTML = fmt(deP) + "<small>€</small>"; $("srcDE").textContent = regionCheap ? `Live · ${town(regionCheap)}` : deP ? "Grens · " + (S.data.de.border.at ? hhmm(S.data.de.border.at) : dayLabel(S.data.de.border.date)) : "–"; }
  const opts = [["België", beL], ["Duitsland", S.fuel === "lpg" ? null : deP]].filter((o) => o[1]).sort((a, b) => a[1] - b[1]), v = $("verdict");
  if (opts.length) {
    const [land, p] = opts[0], d = nl.p - p;
    v.className = "verdict " + (d > 0 ? "good" : "bad"); $("vBig").textContent = (d >= 0 ? "−" : "+") + Math.round(Math.abs(d) * 100) + " ct";
    $("vHead").textContent = d > 0 ? `Goedkoopst in ${land}` : "Nederland is niet duurder";
    $("vSub").textContent = d > 0 ? `${eur(d * settings().L)} minder voor ${settings().L} L, zonder rijkosten` : "";
  }

  renderCarSum(); renderSearch(); renderMap(); renderDays(); renderCompare(); renderFills();
  $("alertFuel").textContent = FUELNAME[S.fuel];
  if (document.activeElement !== $("alertP")) $("alertP").value = S.alert[S.fuel] || "";
}

function card(s, med) {
  const p = s[S.fuel], cls = s.src === "tk" ? (s.isOpen ? classOf(p, med) : "off") : "off", fav = S.favs.has(s.id), n = p ? netSave(s) : null, km = p && S.home ? tripKm(s) : null;
  const flag = `<i class="flag ${s.cc.toLowerCase()}"></i>`;
  const ref = s.src === "osm" ? refPrice(s.cc) : null;
  let detail = "";
  if (S.open === s.id && s.src === "tk") {
    const d = S.details[s.id];
    const hrs = d ? (d.error ? esc(d.error) : d.wholeDay ? "24 uur open" : (d.openingTimes || []).map((o) => `${esc(o.text)} ${esc(o.start?.slice(0, 5))}–${esc(o.end?.slice(0, 5))}`).join(" · ") || "Openingstijden onbekend") : "Openingstijden laden…";
    detail = `<div class="meta">E10 ${fmt(s.e10)} · E5 ${fmt(s.e5)} · Diesel ${fmt(s.diesel)}</div><div class="meta">${hrs}</div>`;
  }
  return `<div class="sc" data-id="${s.id}">
    <div class="nm"><b>${flag}${esc(s.brand || s.name)}${s.hwy ? '<span class="tag">Snelweg</span>' : ""}${s.unmanned ? '<span class="tag ok">Onbemand</span>' : ""}</b><span>${esc([s.street, town(s)].filter(Boolean).join(", ") || "Adres onbekend")}</span></div>
    <div class="pr">${p ? fmt(p) : "–"}<small>${s.bron?.[S.fuel] === "google" ? "Google · " + geleden(s.gp[S.fuel].t) : s.bron?.[S.fuel] === "melding" ? "gemeld " + geleden(s.meld[S.fuel].t) : p ? "live" : ref ? "gem. " + fmt(ref) : "geen prijs"}</small></div>
    <div class="meta"><button class="star${fav ? " on" : ""}" data-fav="${s.id}" aria-label="Favoriet">${fav ? "★" : "☆"}</button>${s.src === "tk" ? `<span class="pill ${cls}"><i class="dot"></i>${s.isOpen ? CLS[cls] : "Gesloten"}</span>` : ""}${s.dist != null ? `<span>${fmt(s.dist, 1)} km</span>` : s.border != null ? `<span>${fmt(s.border, 1)} km van grens</span>` : ""}${n != null && S.home ? `<span class="net ${n >= 0 ? "pos" : "neg"}" title="Na ${fmt(km, 0)} km heen en terug">${n >= 0 ? "loont: " : "loont niet: "}${eur(n)}</span>` : ""}</div>
    ${detail}
    <div class="acts">${navBtns(s)}</div>${s.src === "osm" ? `<button class="meldbtn" data-meld="${esc(s.id)}">${s.meld?.[S.fuel] ? "Andere prijs gezien? Melden" : "Prijs gezien? Meld hem voor anderen"}</button>` : ""}
  </div>`;
}
function renderSearch() {
  const list = sortList(visible()), med = median(list.filter((s) => s[S.fuel]).map((s) => s[S.fuel]));
  let title, note = "";
  if (S.mode === "search" && S.place) {
    title = S.place.name;
    const tkN = list.filter((s) => s.src === "tk").length, osmN = list.filter((s) => s.src === "osm").length;
    if (S.searching) note = "Zoeken…";
    else if (S.searchErr) note = S.searchErr;
    const gN = list.filter((s) => s.bron?.[S.fuel] === "google").length, mN = list.filter((s) => s.bron?.[S.fuel] === "melding").length;
    if (!S.searching && !S.searchErr) note = [tkN && S.fuel !== "lpg" ? `${tkN} met live prijs` : "", gN ? `${gN} met pompprijs via Google` : "", mN ? `${mN} met gemelde prijs` : "", osmN - gN - mN > 0 ? `${osmN - gN - mN} zonder prijs` : "", S.fuel === "lpg" && !gN && !mN ? "LPG: nog geen prijzen per station" : "", !S.key && S.place.cc === "DE" ? "live prijzen met sleutel (Meer)" : ""].filter(Boolean).join(" · ");
  } else {
    title = S.key ? "Grensstrook · " + REGIONS[S.region].name : "Zoek tankstations";
    note = S.key ? (S.busy ? "Laden…" : S.error || "") : "Typ een plaats of kies er een hierboven.";
  }
  $("resTitle").textContent = title; $("resNote").textContent = note;
  const alts = S.mode === "search" && S.alts?.length && !S.searching ? `<div class="chiprow">${S.alts.map((a, i) => `<button data-alt="${i}">${esc(a.name)}</button>`).join("")}</div>` : "";
  $("list").innerHTML = alts + (list.length ? list.map((s) => card(s, med)).join("") : (S.searching || S.busy || (S.mode === "border" && !S.key) ? "" : `<div class="empty">Geen tankstations gevonden.</div>`));
  const brands = [...new Set(baseList().map((s) => s.brand || s.name))].sort((a, b) => a.localeCompare(b));
  const html = `<option value="">Alle merken</option>` + brands.map((b) => `<option>${esc(b)}</option>`).join("");
  if ($("brand").innerHTML !== html) { $("brand").innerHTML = html; $("brand").value = brands.includes(S.brand) ? S.brand : ""; }
}

// ---------- kaart + route ----------
let map, layer;
function ensureMap() {
  if (map || typeof L === "undefined") return !!map;
  map = L.map("map").setView([51.9, 6.4], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
  L.polyline(BORDER, { color: "#888", weight: 2, dashArray: "6 6" }).addTo(map);
  layer = L.layerGroup().addTo(map);
  return true;
}
function renderMap() {
  if (S.tab !== "kaart" || !ensureMap()) return;
  setTimeout(() => map.invalidateSize(), 50);
  layer.clearLayers();
  const all = visible(), med = median(all.filter((s) => s[S.fuel]).map((s) => s[S.fuel]));
  const css = getComputedStyle(document.documentElement), col = (v) => css.getPropertyValue(v).trim();
  const colors = { good: col("--good"), mid: col("--mid"), bad: col("--bad"), off: col("--muted") };
  all.forEach((s) => {
    const p = s[S.fuel], cls = s.src === "tk" && s.isOpen ? classOf(p, med) : "off";
    L.circleMarker([s.lat, s.lng], { radius: 8, color: "#fff", weight: 2, fillColor: colors[cls], fillOpacity: .95 })
      .bindPopup(`<b>${esc(s.brand || s.name)}</b><br>${esc(s.street)} ${esc(town(s))}<br><b style="font-size:1.15em">${p ? fmt(p) + " €/L" : "geen live prijs"}</b><br><a class="big" style="margin-top:6px;min-height:36px;padding:.3rem .8rem;color:#fff" href="${nav.google(s)}" target="_blank" rel="noopener">Route</a>`).addTo(layer);
  });
  {
    const key = S.mode + (S.place?.name || S.region) + all.length;
    if (map._k !== key) { const pts = all.length ? all.map((s) => [s.lat, s.lng]) : S.place?.lat ? [[S.place.lat, S.place.lng]] : REGIONS[S.region].pts; map.fitBounds(L.latLngBounds(pts).pad(.15), { maxZoom: 14 }); map._k = key; }
  }
}
function getPos(timeout = 8000) {
  return new Promise((res) => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { timeout, maximumAge: 120000 }); });
}
// ---------- dagprijzen ----------
const hIdx = (f) => f === "diesel" ? 2 : 1;
const fromHist = (arr, k, f) => { const r = (arr || []).find((x) => x[0] === k); return r ? r[hIdx(f)] : null; };
const deDay = (k, f) => { const d = S.hist[k]?.[S.region]?.[f]; return d && d[1] ? d[0] / d[1] : fromHist(S.data.history?.deAvg, k, f); };
const beDay = (k, f) => S.data.history?.beAvg ? fromHist(S.data.history.beAvg, k, f) : fromHist(S.data.history?.beMax, k, f);
function renderDays() {
  if (S.tab !== "dag") return;
  const rows = cbsRows(), nlIdx = S.fuel === "diesel" ? 2 : 1, F = S.fuel === "diesel" ? "diesel" : "e10";
  const days = new Set(rows.map((r) => r[0])); Object.keys(S.hist).forEach((k) => days.add(k)); ["deAvg", S.data.history?.beAvg ? "beAvg" : "beMax"].forEach((n) => (S.data.history?.[n] || []).forEach((r) => days.add(r[0])));
  const keys = [...days].sort().slice(-45), nlMap = Object.fromEntries(rows.map((r) => [r[0], r]));
  const nlS = keys.map((k) => nlMap[k]?.[nlIdx] ?? null), deS = keys.map((k) => deDay(k, F)), beS = keys.map((k) => beDay(k, F));
  const vals = [...(S.fuel !== "e5" && S.fuel !== "lpg" ? nlS : []), ...deS, ...beS].filter((v) => v != null), svg = $("chart");
  if (vals.length) {
    let lo = Math.min(...vals), hi = Math.max(...vals); const pv = Math.max(.03, (hi - lo) * .15); lo -= pv; hi += pv;
    const W = 400, H = 230, l = 40, r = 8, t = 10, b = 24, X = (i) => l + (keys.length < 2 ? 0 : i * (W - l - r) / (keys.length - 1)), Y = (v) => t + (hi - v) * (H - t - b) / (hi - lo);
    let g = ""; for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4; g += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="currentColor" opacity=".15"/><text x="${l - 5}" y="${Y(v) + 4}" text-anchor="end">${fmt(v, 2)}</text>`; }
    const step = Math.ceil(keys.length / 5); keys.forEach((k, i) => { if (i % step === 0 || i === keys.length - 1) g += `<text x="${X(i)}" y="${H - 6}" text-anchor="${i === keys.length - 1 ? "end" : i === 0 ? "start" : "middle"}">${dayLabel(k)}</text>`; });
    const path = (s) => { let d = "", pen = false; s.forEach((v, i) => { if (v == null) return; d += (pen ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); pen = true; }); return d; };
    const last = (s, c) => { for (let i = s.length - 1; i >= 0; i--) if (s[i] != null) return `<circle cx="${X(i)}" cy="${Y(s[i])}" r="3.5" fill="${c}"/>`; return ""; };
    svg.style.color = "var(--muted)";
    svg.innerHTML = g + (S.fuel !== "e5" && S.fuel !== "lpg" ? `<path d="${path(nlS)}" fill="none" stroke="var(--nl)" stroke-width="2.5"/>${last(nlS, "var(--nl)")}` : "") + `<path d="${path(beS)}" fill="none" stroke="var(--be)" stroke-width="2.5" stroke-dasharray="5 3"/>${last(beS, "var(--be)")}<path d="${path(deS)}" fill="none" stroke="var(--de)" stroke-width="2.5"/>${last(deS, "var(--de)")}`;
  }
  $("dayNote").textContent = `${FUELNAME[S.fuel]}${S.fuel === "e5" || S.fuel === "lpg" ? " (lijnen tonen E10)" : ""}`;
  const delta = (k, i) => { const x = rows.findIndex((r) => r[0] === k); if (x < 1) return ""; const d = Math.round((rows[x][i] - rows[x - 1][i]) * 1000) / 10; return `<span class="${d > 0 ? "neg" : d < 0 ? "pos" : ""}">${d > 0 ? "+" : d < 0 ? "−" : "±"}${fmt(Math.abs(d), 1)}</span>`; };
  $("dayBody").innerHTML = [...keys].reverse().slice(0, 14).map((k) => { const n = nlMap[k];
    return `<tr><td>${dayLabel(k)}</td><td class="n">${fmt(n?.[1])}</td><td class="n">${n ? delta(k, 1) : ""}</td><td class="n">${fmt(n?.[2])}</td><td class="n">${n ? delta(k, 2) : ""}</td><td class="n">${fmt(beDay(k, "e10"))}</td><td class="n">${fmt(beDay(k, "diesel"))}</td><td class="n">${fmt(deDay(k, "e10"))}</td><td class="n">${fmt(deDay(k, "diesel"))}</td></tr>`; }).join("");
}

// ---------- bespaar ----------
function nearestCross() { if (!S.home) return null; let best = null, bd = Infinity; for (const c of BE_CROSS) { const d = haversine([S.home.lat, S.home.lng], [c[1], c[2]]); if (d < bd) { bd = d; best = c; } } return { name: best[0], km: bd * 2 * ROAD }; }
function deCross() { let bd = Infinity, name = ""; for (const r of Object.values(REGIONS)) for (const p of r.pts) { const d = haversine([S.home.lat, S.home.lng], p); if (d < bd) { bd = d; name = r.name; } } return { name, km: bd * 2 * ROAD }; }
function options() {
  if (!S.home) return [];
  const out = [], nb = nearestCross();
  if (beLow()) out.push({ s: { id: "opt-be", src: "opt", cc: "BE", brand: "België", name: "", street: "grensovergang", place: nb.name, lat: BE_CROSS.find((c) => c[0] === nb.name)[1], lng: BE_CROSS.find((c) => c[0] === nb.name)[2], ...(() => { const pv = S.data.be?.prov?.[BE_PROV[nb.name]]; return { e10: pv?.e10 ?? beLow("e10"), diesel: pv?.diesel ?? beLow("diesel"), e5: pv?.e5 ?? beLow("e5"), lpg: pv?.lpg ?? beLow("lpg") }; })(), isOpen: true }, label: `België, ${nb.name}`, note: "laagste prijs in de provincie" });
  const b = bestDE();
  if (b) out.push({ s: b, label: `${b.brand || b.name}, ${town(b)}`, note: "live" });
  else if (deBorder()) { let bd = Infinity, pt = null, rn = ""; for (const r of Object.values(REGIONS)) for (const p of r.pts) { const d = haversine([S.home.lat, S.home.lng], p); if (d < bd) { bd = d; pt = p; rn = r.name; } }
    out.push({ s: { id: "opt-de", src: "opt", cc: "DE", brand: "Duitsland", name: "", street: "grens", place: rn, lat: pt[0], lng: pt[1], e10: deBorder("e10"), diesel: deBorder("diesel"), e5: null, isOpen: true }, label: `Duitsland, ${rn}`, note: "grensprijs" }); }
  out.forEach((o) => { o.km = tripKm(o.s); o.net = netSave(o.s, o.km); });
  return out.filter((o) => o.s[S.fuel]).sort((x, y) => y.net - x.net);
}
function renderCarSum() {
  const { L, use, tank } = settings(), car = $("car").value;
  $("carSum").textContent = `${car && car !== "__own" ? car + " · " : ""}${FUELNAME[S.fuel]} · ${fmt(use, 1)} L/100 km (1 op ${fmt(100 / use, 1)}) · tank ${tank} L · nu ${L} L tanken${S.home ? "" : " · zet je locatie aan voor de besparing"}`;
  if (document.activeElement !== $("cFuel")) $("cFuel").value = S.fuel;
  if (document.activeElement !== $("cKmL")) $("cKmL").value = use > 0 ? Math.round(1000 / use) / 10 : "";
}
function renderCompare() {
  const { L } = settings(), nl = nlPrice().p, opts = options(); S.opts = opts;
  const best = opts[0];
  [["vRoute", nav.google], ["vApple", nav.apple]].forEach(([id, f]) => { const a = $(id); if (best) { a.href = f(best.s); a.removeAttribute("aria-disabled"); } else { a.removeAttribute("href"); a.setAttribute("aria-disabled", "true"); } });
  if (best) {
    const d = nl - best.s[S.fuel];
    $("verdict").className = "verdict " + (best.net > 0 ? "good" : "bad");
    $("vBig").textContent = (d >= 0 ? "−" : "+") + Math.round(Math.abs(d) * 100) + " ct";
    $("vHead").textContent = best.net > 0 ? `Voordeligst: ${best.label}` : "Omrijden loont nu niet";
    $("vSub").textContent = `Netto ${eur(best.net)} vanaf je huidige locatie, na rijkosten`;
  }
  if (!S.home) $("vSub").textContent = "Zet je locatie aan voor de netto besparing na rijkosten.";
  $("lvlLbl").textContent = $("cLvl").value + "%"; $("litLbl").textContent = L + " L";
  if (document.activeElement !== $("cNL")) $("cNL").value = S.nlOwn[S.fuel] || ""; $("cNL").placeholder = fmt(nlPrice().p);
}
function fillRef(c, f = S.fuel) { // voorgestelde prijs per land
  if (c === "NL") return nlPrice(f).p;
  const o = (S.opts || []).find((x) => x.s.cc === c); if (o && o.s[f]) return o.s[f];
  return c === "BE" ? beLow(f) : (bestDE()?.[f] ?? deBorder(f));
}
const fillNL = (d, f) => S.nlOwn[f] || (f === "e5" ? nlPrice("e5").p : cbsOn(d.replace(/-/g, ""), f));
function renderFills() {
  const save = (r) => r.c !== "NL" ? (r.nl - r.p) * r.l : 0;
  const now = new Date(), yr = String(now.getFullYear()), mo = now.toISOString().slice(0, 7);
  const sum = (l) => l.reduce((a, r) => a + save(r), 0);
  const ty = S.fills.filter((r) => r.d.startsWith(yr)), tm = S.fills.filter((r) => r.d.startsWith(mo));
  $("saveHero").innerHTML = `<div class="main"><span>Bespaard in ${yr}</span><b>${eur(sum(ty))}</b></div>
    <div><span>Deze maand</span><b>${eur(sum(tm))}</b></div><div><span>Totaal</span><b>${eur(sum(S.fills))}</b></div><div><span>Tankbeurten</span><b>${S.fills.length}</b></div>`;
  const rows = [...S.fills].map((r, i) => ({ ...r, i })).sort((a, b) => b.d.localeCompare(a.d));
  $("fBody").innerHTML = rows.length ? rows.map((r) => { const v = r.c !== "NL" ? save(r) : null;
    return `<tr><td>${dayLabel(r.d.replace(/-/g, ""))}</td><td>${r.c}</td><td class="n">${fmt(r.l, 1)}</td><td class="n">${fmt(r.p)}</td><td class="n ${v > 0 ? "pos" : v < 0 ? "neg" : ""}">${v != null ? eur(v) : "–"}</td><td><button class="iconbtn" style="width:32px;height:32px" data-delfill="${r.i}" aria-label="Verwijder">✕</button></td></tr>`; }).join("")
    : `<tr><td colspan="6" class="note">Nog geen tankbeurten opgeslagen.</td></tr>`;
  // formulier vooraf invullen
  document.querySelectorAll("[data-fc]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.fc === S.fc));
  if (!S.fPEdited && document.activeElement !== $("fP")) { const p = fillRef(S.fc); $("fP").value = p ? p.toFixed(3) : ""; }
  if (!S.fLEdited && document.activeElement !== $("fL")) $("fL").value = settings().L;
  const l = parseFloat($("fL").value), p = parseFloat($("fP").value), nl = fillNL($("fDate").value || todayKey(), S.fuel);
  $("fPreview").textContent = l > 0 && p > .5 ? (S.fc === "NL" ? `Kosten ${eur(l * p)}` : `Kosten ${eur(l * p)} · bespaard ${eur((nl - p) * l)} t.o.v. Nederland (${fmt(nl)})`) : "";
}

// ---------- bediening ----------
function showTab(t) {
  S.tab = t;
  document.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
  document.querySelectorAll("[data-view]").forEach((v) => v.hidden = v.dataset.view !== t);
  window.scrollTo(0, 0); render();
}
document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
$("searchForm").addEventListener("submit", (e) => { e.preventDefault(); $("q").blur(); doSearch($("q").value); });
$("q").value = store.get("tw_lastq", "");
const QUICK = [["Emmerich", 51.832, 6.246, "DE"], ["Kleve", 51.788, 6.138, "DE"], ["Gronau", 52.212, 7.023, "DE"], ["Kaldenkirchen", 51.318, 6.196, "DE"], ["Aachen", 50.776, 6.084, "DE"], ["Bad Bentheim", 52.303, 7.159, "DE"], ["Lanaken", 50.893, 5.648, "BE"], ["Baarle-Hertog", 51.441, 4.927, "BE"]];
$("quick").innerHTML = QUICK.map((q, i) => `<button data-q="${i}">${q[0]}</button>`).join("");
$("quick").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (!b) return; const [name, lat, lng, cc] = QUICK[+b.dataset.q]; $("q").value = name; S.alts = []; searchPlace({ name, lat, lng, cc }); });
$("locBtn").addEventListener("click", async () => {
  $("locBtn").textContent = "Locatie bepalen…";
  const pos = await getPos(12000); $("locBtn").innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>Mijn locatie';
  if (!pos) { S.mode = "search"; S.place = { name: "Mijn locatie" }; S.found = []; S.searchErr = "Geen toegang tot je locatie. Sta locatie toe in je instellingen."; render(); return; }
  const rc = await reverseCC(pos.lat, pos.lng); S.alts = [];
  searchPlace({ name: rc.name, lat: pos.lat, lng: pos.lng, cc: rc.cc || "NL" });
});
$("list").addEventListener("click", (e) => {
  const alt = e.target.closest("[data-alt]"); if (alt) { const a = S.alts[+alt.dataset.alt]; $("q").value = a.name; S.alts = []; searchPlace(a); return; }
  const ml = e.target.closest("[data-meld]"); if (ml) { meldPrijs(ml.dataset.meld); return; }
  const fav = e.target.closest("[data-fav]"); if (fav) { const id = fav.dataset.fav; S.favs.has(id) ? S.favs.delete(id) : S.favs.add(id); store.set("tw_favs", [...S.favs]); render(); return; }
  if (e.target.closest("a,button")) return;
  const row = e.target.closest(".sc"); if (!row) return;
  S.open = S.open === row.dataset.id ? null : row.dataset.id; render(); if (S.open && !S.open.startsWith("osm")) loadDetail(S.open);
});
$("filterBtn").addEventListener("click", () => { $("filters").hidden = !$("filters").hidden; });
$("sort").value = S.sort; $("sort").addEventListener("change", (e) => { S.sort = e.target.value; store.set("tw_sort2", S.sort); render(); });
$("brand").addEventListener("change", (e) => { S.brand = e.target.value; render(); });
[["openOnly", "openOnly", "tw_open"], ["noHwy", "noHwy", "tw_nohwy"], ["favOnly", "favOnly", null]].forEach(([id, k, sk]) => { $(id).checked = S[k]; $(id).addEventListener("change", (e) => { S[k] = e.target.checked; if (sk) store.set(sk, S[k]); render(); }); });
$("region").innerHTML = Object.entries(REGIONS).map(([k, r]) => `<option value="${k}">${r.name}</option>`).join(""); $("region").value = S.region;
$("region").addEventListener("change", (e) => { S.region = e.target.value; store.set("tw_region", S.region); S.mode = "border"; update(); });
document.querySelectorAll("[data-fuel]").forEach((b) => { b.setAttribute("aria-pressed", b.dataset.fuel === S.fuel);
  b.addEventListener("click", () => { S.fuel = b.dataset.fuel; store.set("tw_fuel", S.fuel); document.querySelectorAll("[data-fuel]").forEach((x) => x.setAttribute("aria-pressed", x === b)); render(); }); });

document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-gotab]"); if (g) { showTab(g.dataset.gotab); return; }
});

// auto + vertrekpunt
function nearestRegion(lat, lng) { let best = null, bd = Infinity; for (const [k, r] of Object.entries(REGIONS)) for (const p of r.pts) { const d = haversine([lat, lng], p); if (d < bd) { bd = d; best = k; } } return best; }
async function refreshLocation(force = false) {
  if (!force && S.locTs && Date.now() - S.locTs < 10 * 60000) return;
  const p = await getPos(12000);
  if (!p) { S.locDenied = !S.home; render(); return; }
  S.locTs = Date.now(); S.locDenied = false; S.home = { name: "jouw locatie", ...p }; store.set("tw_gps", S.home);
  const r = nearestRegion(p.lat, p.lng); if (r && r !== S.region) { S.region = r; store.set("tw_region", r); $("region").value = r; update(); }
  render();
}
$("car").innerHTML = CARS.map(([n, u, t]) => `<option value="${n}">${n} · ${fmt(u, 1)} L</option>`).join("") + `<option value="__own">Eigen waarden</option>`;
$("car").value = store.get("tw_car", "Gemiddelde auto");
$("car").addEventListener("change", (e) => { store.set("tw_car", e.target.value); const c = CARS.find((x) => x[0] === e.target.value); if (c) { $("cUse").value = c[1]; $("cTank").value = c[2]; store.set("tw_cUse", c[1]); store.set("tw_cTank", c[2]); } render(); });
["cUse", "cTank", "cLvl"].forEach((id) => { const v = store.get("tw_" + id, null); if (v != null) $(id).value = v;
  $(id).addEventListener("input", () => { store.set("tw_" + id, $(id).value); if (id !== "cLvl") { $("car").value = "__own"; store.set("tw_car", "__own"); } render(); }); });
if (store.get("tw_cUse", null) == null) { const c = CARS.find((x) => x[0] === $("car").value); if (c) { $("cUse").value = c[1]; $("cTank").value = c[2]; } }
$("cFuel").addEventListener("change", () => { const f = $("cFuel").value; document.querySelector(`[data-fuel="${f}"]`)?.click(); });
$("cKmL").addEventListener("input", () => { const k = parseFloat(String($("cKmL").value).replace(",", ".")); if (k > 3 && k < 60) { $("cUse").value = (Math.round(1000 / k) / 10); store.set("tw_cUse", $("cUse").value); $("car").value = "__own"; store.set("tw_car", "__own"); render(); } });
$("mijnauto").addEventListener("toggle", () => { if ($("mijnauto").open) gc("auto/open", "Mijn auto geopend"); });
$("cNL").addEventListener("change", () => { const v = parseFloat($("cNL").value); if (v > .5 && v < 5) S.nlOwn[S.fuel] = v; else delete S.nlOwn[S.fuel]; store.set("tw_nlOwn", S.nlOwn); render(); });

// tankbeurten
$("fDate").value = new Date().toISOString().slice(0, 10);
S.fc = "DE";
document.querySelectorAll("[data-fc]").forEach((b) => b.addEventListener("click", () => { S.fc = b.dataset.fc; S.fPEdited = false; renderFills(); }));
$("fP").addEventListener("input", () => { S.fPEdited = true; renderFills(); });
$("fL").addEventListener("input", () => { S.fLEdited = true; renderFills(); });
$("fDate").addEventListener("change", renderFills);
$("fAdd").addEventListener("click", () => {
  const d = $("fDate").value, l = parseFloat($("fL").value), p = parseFloat($("fP").value);
  if (!d || !(l > 0) || !(p > .5 && p < 5)) { $("fMsg").textContent = "Vul liters en prijs in."; $("fL").focus(); return; }
  const nl = fillNL(d, S.fuel);
  S.fills.push({ d, c: S.fc, f: S.fuel, l, p, nl }); store.set("tw_fills", S.fills);
  $("fMsg").textContent = S.fc === "NL" ? "Tankbeurt opgeslagen." : `Opgeslagen: ${eur((nl - p) * l)} bespaard.`;
  S.fPEdited = S.fLEdited = false; render();
});
$("fBody").addEventListener("click", (e) => { const b = e.target.closest("[data-delfill]"); if (b) { S.fills.splice(+b.dataset.delfill, 1); store.set("tw_fills", S.fills); render(); } });

// alarm, sleutel, thema
// Prijsalarm via onze server: werkt ook als de app dicht is (pushmelding). Alleen het abonnement, je bedragen en een grove locatie worden bewaard.
const pushKan = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const b64ToBytes = (s) => { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
async function pushSub() { if (!pushKan) return null; try { const r = await navigator.serviceWorker.getRegistration(); return r ? await r.pushManager.getSubscription() : null; } catch (e) { return null; } }
const thuisGrof = () => S.home ? [Math.round(S.home.lat * 10) / 10, Math.round(S.home.lng * 10) / 10] : null;
async function alarmSync(sub) { sub = sub || await pushSub(); if (!sub) return false; try { const r = await fetch("/api/alarm", { method: Object.keys(S.alert).length ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sub: sub.toJSON(), alarmen: S.alert, thuis: thuisGrof() }) }); return r.ok; } catch (e) { return false; } }
function alarmTekst() { const l = Object.entries(S.alert).map(([f, v]) => `${FUELNAME[f]} onder € ${fmt(v)}`); return l.length ? (S.pushOn ? "🔔 Alarm staat aan: " : "Alarm ingesteld: ") + l.join(", ") + "." : ""; }
async function alarmAan() {
  const v = parseFloat(String($("alertP").value).replace(",", ".")); if (!(v > .5 && v < 4)) { $("alertMsg").textContent = "Vul een prijs in, bijvoorbeeld 2,099."; $("alertP").focus(); return; }
  S.alert[S.fuel] = v; store.set("tw_alert", S.alert);
  if (!pushKan) { $("alertMsg").textContent = IOS ? "Op iPhone werkt dit als je Tankwijzer op je beginscherm zet: tik op deel ⬆️ en kies Zet op beginscherm. Open hem daarna vanaf je beginscherm." : "Je browser ondersteunt geen meldingen."; return; }
  try {
    if ((await Notification.requestPermission()) !== "granted") { $("alertMsg").textContent = "Meldingen zijn niet toegestaan. Zet ze aan in de instellingen van je browser."; return; }
    const reg = await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready;
    const { sleutel } = await (await fetch("/api/alarm")).json(); if (!sleutel) throw new Error();
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(sleutel) });
    S.pushOn = await alarmSync(sub); gc("alarm/aan/" + S.fuel, "Prijsalarm aan");
    $("alertMsg").textContent = S.pushOn ? alarmTekst() + " Je krijgt bericht zodra het zover is (hoogstens twee keer per dag)." : "Aanzetten lukte niet. Probeer het later nog eens.";
  } catch (e) { $("alertMsg").textContent = "Aanzetten lukte niet. Probeer het later nog eens."; }
}
$("alertPerm").addEventListener("click", alarmAan);
$("alertP").addEventListener("change", () => { const v = parseFloat(String($("alertP").value).replace(",", ".")); if (!(v > .5 && v < 4)) { delete S.alert[S.fuel]; store.set("tw_alert", S.alert); alarmSync(); $("alertMsg").textContent = alarmTekst() || "Alarm uit."; } });
pushSub().then((sub) => { S.pushOn = !!sub && Object.keys(S.alert).length > 0; if (S.pushOn) alarmSync(sub); $("alertMsg").textContent = alarmTekst(); });
// Oude eigen sleutel en demodata uit eerdere versies opruimen; live prijzen werken nu voor iedereen.
if (store.get("tw_key", "")) { try { localStorage.removeItem("tw_key"); } catch (e) {} S.cache = {}; store.set("tw_cache", {}); }
$("clearCache").addEventListener("click", () => { S.cache = {}; S.hist = {}; S.cbs = null; store.set("tw_cache", {}); store.set("tw_hist", {}); store.set("tw_cbs", null); loadCBS(); update("list"); });
function applyTheme() { if (S.theme === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = S.theme; document.querySelectorAll("[data-theme-set]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.themeSet === S.theme)); }
document.querySelectorAll("[data-theme-set]").forEach((b) => b.addEventListener("click", () => { S.theme = b.dataset.themeSet; store.set("tw_theme", S.theme); applyTheme(); render(); }));
applyTheme();

// verversen: start, terug in beeld, elke 5 minuten
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { update(); loadCBS(); loadData(); refreshLocation(); } });
setInterval(() => { if (document.visibilityState === "visible") update(); }, 60 * 1000);
setInterval(() => { if (document.visibilityState === "visible") loadData(); }, 30 * 60 * 1000);
window.addEventListener("online", () => update());

showTab("zoek"); loadCBS(); loadData(); update(); refreshLocation(true);
// Direct zoeken via een link uit de tankgids, bijvoorbeeld /?q=Kleve
{ const qp = new URLSearchParams(location.search).get("q"); if (qp) { $("q").value = qp; doSearch(qp); history.replaceState(null, "", location.pathname); } }
document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => gc("tab/" + b.dataset.tab, "Tab " + b.dataset.tab)));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
