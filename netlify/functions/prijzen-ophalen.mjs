// Elk half uur: dagprijzen ophalen en bewaren in Netlify Blobs (store "prijzen", sleutel "data").
// Nederland: landelijke adviesprijs (UnitedConsumers). België: maximumprijs, laagste prijs per provincie (carbu.com)
// en weekgemiddelde (EU Oil Bulletin). Duitsland: goedkoopste station in de grensstrook, live via Tankerkönig,
// en het landelijke weekgemiddelde (EU Oil Bulletin).
// Lukt een bron niet, dan blijven de vorige waarden staan. Zo kost bijwerken niets en loopt het altijd door.
import { getStore } from '@netlify/blobs';
import { BRONNEN, nlAdvies, beMax, beProv, beAvg, deAvg, GRENS_DE } from '../bronnen.mjs';
import { controleerAlarmen } from '../alarm.mjs';
import basis from '../../site/data-basis.json' with { type: 'json' };

const UA = 'Mozilla/5.0 (compatible; Tankwijzer/2.0; +https://goedkopertanken.netlify.app)';
const haal = async url => { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'nl-NL,nl;q=0.9' }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(url + ' ' + r.status); return r.text(); };
const vandaagNL = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date()).replace(/-/g, '');
function tijdNL() {
  const d = new Date(), f = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(d).replace(' ', 'T');
  const off = Math.round((new Date(f + 'Z') - d) / 60000), u = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0'), m = String(Math.abs(off) % 60).padStart(2, '0');
  return `${f}${off >= 0 ? '+' : '-'}${u}:${m}`;
}
// Voeg [datum, e10, diesel] toe (zelfde datum vervangen), hoogstens 120 regels.
function hist(lijst, datum, e10, diesel) {
  if (!datum || (e10 == null && diesel == null)) return lijst || [];
  const l = (lijst || []).filter(r => r[0] !== datum); l.push([datum, e10 ?? null, diesel ?? null]);
  return l.sort((a, b) => a[0].localeCompare(b[0])).slice(-120);
}
const SNELWEG = /\b(bab|autobahn|rasthof|raststätte|rastst|autohof|truck|lkw|a\s?\d{1,3}\b)/i;

export async function verzamel(oud, key, log = console.log) {
  const d = structuredClone(oud);
  d.nl ||= {}; d.be ||= {}; d.de ||= {}; d.history ||= {};
  const stap = async (naam, fn) => { try { await fn(); } catch (e) { log(`${naam} mislukt: ${e.message}`); } };

  await stap('NL', async () => {
    const r = nlAdvies(await haal(BRONNEN.nl)); if (!r) throw new Error('pagina veranderd');
    d.nl.advies = { ...r, src: 'UnitedConsumers landelijke adviesprijs' };
    d.nl.adviesHist = hist(d.nl.adviesHist, r.date, r.e10, r.diesel);
  });
  await stap('BE max', async () => {
    const r = beMax(await haal(BRONNEN.beMax)); if (!r) throw new Error('pagina veranderd');
    d.be.max = { ...r.max, src: 'officiële maximumprijs (FOD Economie)' }; d.be.next = r.next;
    d.history.beMax = hist(d.history.beMax, r.max.date, r.max.e10, r.max.diesel);
  });
  await stap('BE provincies', async () => {
    const p = beProv(await haal(BRONNEN.beProv)); if (!p) throw new Error('pagina veranderd');
    const datum = vandaagNL();
    d.be.prov = { date: datum, ...p };
    const low = { date: datum, where: {}, src: 'laagste prijs grensprovincies (Antwerpen, Limburg, Luik)' };
    for (const f of ['e10', 'e5', 'diesel', 'lpg']) for (const pr of ['Antwerpen', 'Limburg', 'Luik']) {
      const v = p[pr]?.[f]; if (v != null && (low[f] == null || v < low[f])) { low[f] = v; low.where[f] = pr; }
    }
    d.be.low = low;
    d.history.beLow = hist(d.history.beLow, datum, low.e10, low.diesel);
  });
  await stap('BE gemiddelde', async () => {
    const r = beAvg(await haal(BRONNEN.beAvg)); if (!r) throw new Error('pagina veranderd');
    if (!d.be.avg?.date || r.date >= d.be.avg.date) { d.be.avg = { ...r, src: 'EU Weekly Oil Bulletin, gemiddelde pompprijs' }; d.history.beAvg = hist(d.history.beAvg, r.date, r.e10, r.diesel); }
  });
  await stap('DE gemiddelde', async () => {
    const r = deAvg(await haal(BRONNEN.deAvg)); if (!r) throw new Error('pagina veranderd');
    if (!d.de.avg?.date || r.date >= d.de.avg.date) d.de.avg = { ...r, src: 'EU Weekly Oil Bulletin, gemiddelde pompprijs' };
  });
  if (key) await stap('DE grens', async () => {
    const st = new Map(), punten = {};
    for (const [plaats, lat, lng] of GRENS_DE) {
      const r = await fetch(`https://creativecommons.tankerkoenig.de/json/list.php?lat=${lat}&lng=${lng}&rad=6&sort=dist&type=all&apikey=${key}`, { signal: AbortSignal.timeout(15000) });
      const j = await r.json(); if (!j.ok) throw new Error(j.message || 'fout');
      const hier = (j.stations || []).filter(s => s.isOpen && !SNELWEG.test(`${s.name} ${s.street}`));
      for (const s of hier) st.set(s.id, s);
      // Per grensplaats het goedkoopste open station, voor de plaatspagina's.
      const p = {};
      for (const f of ['e10', 'diesel', 'e5']) { const b = hier.filter(s => s[f] > 0.5).sort((a, c) => a[f] - c[f])[0]; if (b) { p[f] = b[f]; p[f + 'Waar'] = `${(b.brand || b.name).trim()}, ${b.street || ''} ${b.houseNumber || ''}`.replace(/\s+/g, ' ').trim(); } }
      p.n = hier.length; punten[plaats] = p;
    }
    d.de.points = { date: vandaagNL(), at: new Date().toISOString(), ...punten };
    const alle = [...st.values()];
    if (alle.length < 10) throw new Error('te weinig stations: ' + alle.length);
    const best = f => { const l = alle.filter(s => s[f] > 0.5).sort((a, b) => a[f] - b[f]); return l[0] || null; };
    const gem = f => { const l = alle.map(s => s[f]).filter(v => v > 0.5).sort((a, b) => a - b); return l.length ? Math.round(l[Math.floor(l.length / 2)] * 1000) / 1000 : null; };
    const be10 = best('e10'), bdi = best('diesel'), be5 = best('e5'), datum = vandaagNL();
    d.de.border = { e10: be10?.e10 ?? null, diesel: bdi?.diesel ?? null, e5: be5?.e5 ?? null, date: datum, at: new Date().toISOString(),
      where: { e10: be10 && `${be10.brand || be10.name}, ${be10.place}`, diesel: bdi && `${bdi.brand || bdi.name}, ${bdi.place}` }, n: alle.length,
      src: 'goedkoopste open grensstation (Markttransparenzstelle via Tankerkönig)' };
    d.de.borderMid = { e10: gem('e10'), diesel: gem('diesel'), e5: gem('e5'), date: datum, src: 'middenprijs open grensstations (Tankerkönig)' };
    d.history.deBorder = hist(d.history.deBorder, datum, d.de.border.e10, d.de.border.diesel);
    d.history.deMid = hist(d.history.deMid, datum, d.de.borderMid.e10, d.de.borderMid.diesel);
  });
  d.updated = tijdNL();
  return d;
}

export default async () => {
  const store = getStore('prijzen');
  const oud = (await store.get('data', { type: 'json' }).catch(() => null)) || basis;
  const log = [];
  const d = await verzamel(oud, Netlify.env.get('TANKERKOENIG_KEY'), m => { log.push(m); console.log(m); });
  d._ts = Date.now(); d._log = log;
  await store.setJSON('data', d);
  try { await controleerAlarmen(d, Netlify.env.get('VAPID_PUBLIC'), Netlify.env.get('VAPID_PRIVATE')); } catch (e) { console.log('alarm fout ' + e.message); }
  console.log(`prijzen bijgewerkt: NL ${d.nl.advies?.e10}/${d.nl.advies?.diesel} · BE max ${d.be.max?.e10}/${d.be.max?.diesel} · BE laagst ${d.be.low?.e10}/${d.be.low?.diesel} · DE grens ${d.de.border?.e10}/${d.de.border?.diesel}`);
};

export const config = { schedule: '*/30 * * * *' };
