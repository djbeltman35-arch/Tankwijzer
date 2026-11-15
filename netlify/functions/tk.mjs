// Doorgeefluik naar Tankerkönig (live Duitse prijzen per tankstation) voor alle bezoekers.
// De API-sleutel staat alleen hier, als geheime Netlify-instelling (TANKERKOENIG_KEY), nooit in de browser.
// Antwoorden worden 5 minuten op het CDN bewaard, zodat Tankerkönig niet onnodig vaak wordt bevraagd.
import { getStore } from '@netlify/blobs';
const API = 'https://creativecommons.tankerkoenig.de/json/';
const BESTANDEN = { 'list.php': ['lat', 'lng', 'rad', 'sort', 'type'], 'prices.php': ['ids'], 'detail.php': ['id'] };
const json = (data, status, extra = {}) => Response.json(data, { status, headers: extra });
// Alleen West-Duitsland (grensregio en omgeving): zo is dit geen gratis doorgeefluik voor heel Duitsland.
const inRegio = (lat, lng) => lat > 49.3 && lat < 54.6 && lng > 5.6 && lng < 9.8;

export default async (req, context) => {
  const url = new URL(req.url);
  const bestand = context.params?.bestand || url.pathname.split('/').pop();
  const toegestaan = BESTANDEN[bestand];
  if (!toegestaan) return json({ ok: false, message: 'onbekende opvraag' }, 404);
  const key = Netlify.env.get('TANKERKOENIG_KEY');
  if (!key) return json({ ok: false, message: 'Live Duitse prijzen zijn tijdelijk niet beschikbaar.' }, 503);
  if (bestand === 'list.php' && !inRegio(+url.searchParams.get('lat'), +url.searchParams.get('lng'))) return json({ ok: false, message: 'Alleen de Duitse grensregio.' }, 400);
  const q = new URLSearchParams();
  for (const k of toegestaan) {
    let v = url.searchParams.get(k); if (v == null) continue;
    if (k === 'lat' || k === 'lng') { const n = +v; if (!isFinite(n)) return json({ ok: false, message: 'ongeldige plaats' }, 400); v = n.toFixed(3); }
    if (k === 'rad') v = String(Math.min(25, Math.max(1, +v || 5)));
    if (k === 'ids' && !/^[0-9a-f,-]{36,400}$/i.test(v)) return json({ ok: false, message: 'ongeldige ids' }, 400);
    if (k === 'id' && !/^[0-9a-f-]{36}$/i.test(v)) return json({ ok: false, message: 'ongeldig id' }, 400);
    if ((k === 'sort' && !/^(dist|price)$/.test(v)) || (k === 'type' && !/^(all|e5|e10|diesel)$/.test(v))) continue;
    q.set(k, v);
  }
  // Laatste goede antwoord per vraag bewaren: valt Tankerkönig even weg, dan krijgt de bezoeker die prijzen (met tijdstip) in plaats van een fout.
  const sleutel = bestand + '?' + q.toString();
  q.set('apikey', key);
  const reserve = getStore('tk-reserve');
  const uitReserve = async (fout) => {
    console.log('Tankerkönig faalt:', bestand, fout);
    try {
      const oud = await reserve.get(sleutel, { type: 'json' });
      // reserve 1 minuut op het CDN, zodat we Tankerkönig niet blijven bestoken
      if (oud && Date.now() - oud.ts < 6 * 3600e3) return json({ ...oud.j, stale: true, staleTs: oud.ts }, 200, { 'Netlify-CDN-Cache-Control': 'public, s-maxage=60', 'Netlify-Vary': `query=${toegestaan.join('|')}` });
    } catch (e) {}
    return null;
  };
  // Hapert Tankerkönig, dan 2 minuten meteen de reserve gebruiken (snel voor de bezoeker, rustig voor Tankerkönig).
  let storingTot = 0;
  try { storingTot = +(await reserve.get('_storing')) || 0; } catch (e) {}
  if (Date.now() < storingTot) { const r = await uitReserve('storing actief'); if (r) return r; }
  const haal = async (ms) => {
    const r = await fetch(API + bestand + '?' + q, { headers: { 'User-Agent': 'Tankwijzer (goedkopertanken.netlify.app)' }, signal: AbortSignal.timeout(ms) });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.message || 'status ' + r.status);
    return j;
  };
  let j = null, fout = '';
  try { j = await haal(4000); } catch (e) { fout = e.message; }
  if (!j && !/timeout|abort/i.test(fout)) { await new Promise((r) => setTimeout(r, 500)); try { j = await haal(3500); } catch (e) { fout = e.message; } }
  if (j) {
    try { await reserve.setJSON(sleutel, { ts: Date.now(), j }); if (storingTot) await reserve.delete('_storing'); } catch (e) {}
    return json(j, 200, { 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=300, stale-while-revalidate=120', 'Netlify-Vary': `query=${toegestaan.join('|')}` });
  }
  try { await reserve.set('_storing', String(Date.now() + 120e3)); } catch (e) {}
  const r = await uitReserve(fout); if (r) return r;
  return json({ ok: false, message: 'Tankerkönig is even niet bereikbaar.' }, 502);
};

export const config = { path: '/api/tk/:bestand' };
