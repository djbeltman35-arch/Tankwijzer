// Prijzen die bezoekers zelf melden voor tankstations zonder live prijs (Nederland en België).
// GET  /api/melding?lat=..&lng=..  -> meldingen van de afgelopen 48 uur binnen ±15 km
// POST /api/melding {id, naam, lat, lng, cc, fuel, prijs} -> prijs opslaan
// Bewaard in Netlify Blobs (store "meldingen-pomp") per gebied van 0,1 graad; geen persoonsgegevens, alleen een
// onherleidbare dagteller per IP-adres tegen misbruik (max. 30 meldingen per dag).
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const BEREIK = { e10: [1.2, 3.5], diesel: [1.2, 3.5], e5: [1.3, 3.8], lpg: [0.4, 2.0] };
const BEWAAR = 48 * 3600e3;
const json = (data, status = 200, extra = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...extra } });
const vak = (lat, lng) => `v${Math.floor(lat * 10)}_${Math.floor(lng * 10)}`;

export default async (req, context) => {
  const url = new URL(req.url), store = getStore('meldingen-pomp');
  if (req.method === 'GET') {
    const lat = +url.searchParams.get('lat'), lng = +url.searchParams.get('lng');
    if (!isFinite(lat) || !isFinite(lng)) return json({ fout: 'plaats ontbreekt' }, 400);
    const uit = [], nu = Date.now();
    for (let a = -1; a <= 1; a++) for (let b = -2; b <= 2; b++) {
      const v = await store.get(vak(lat + a / 10, lng + b / 10), { type: 'json' }).catch(() => null);
      for (const s of Object.values(v || {})) {
        const prijzen = Object.fromEntries(Object.entries(s.prijzen || {}).filter(([, x]) => nu - x.t < BEWAAR));
        if (Object.keys(prijzen).length) uit.push({ id: s.id, naam: s.naam, lat: s.lat, lng: s.lng, prijzen });
      }
    }
    return json({ ok: true, stations: uit }, 200, { 'Cache-Control': 'public, max-age=0', 'Netlify-CDN-Cache-Control': 'public, s-maxage=60', 'Netlify-Vary': 'query=lat|lng' });
  }
  if (req.method !== 'POST') return json({ fout: 'niet toegestaan' }, 405);
  let b; try { b = await req.json(); } catch { return json({ fout: 'ongeldig verzoek' }, 400); }
  const lat = +b.lat, lng = +b.lng, prijs = Math.round(+b.prijs * 1000) / 1000, fuel = String(b.fuel || '');
  if (!BEREIK[fuel]) return json({ fout: 'onbekende brandstof' }, 400);
  if (!(prijs >= BEREIK[fuel][0] && prijs <= BEREIK[fuel][1])) return json({ fout: 'Die prijs lijkt niet te kloppen.' }, 400);
  if (!(lat > 49.4 && lat < 53.7 && lng > 2.5 && lng < 7.3)) return json({ fout: 'Alleen voor Nederland en België.' }, 400);
  const id = String(b.id || '').slice(0, 40).replace(/[^\w-]/g, ''); if (!id) return json({ fout: 'station ontbreekt' }, 400);
  // Misbruik beperken: tel per dag per (gehasht) IP-adres.
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'onbekend';
  const dag = new Date().toISOString().slice(0, 10), tk = `teller-${dag}-${crypto.createHash('sha256').update(ip + dag).digest('hex').slice(0, 16)}`;
  const n = (await store.get(tk, { type: 'json' }).catch(() => null))?.n || 0;
  if (n >= 30) return json({ fout: 'Je hebt vandaag al veel prijzen gemeld. Dank je wel!' }, 429);
  await store.setJSON(tk, { n: n + 1 });
  const k = vak(lat, lng), v = (await store.get(k, { type: 'json' }).catch(() => null)) || {};
  const s = v[id] || { id, naam: String(b.naam || 'Tankstation').slice(0, 80), lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, prijzen: {} };
  s.prijzen[fuel] = { p: prijs, t: Date.now() };
  for (const [sid, x] of Object.entries(v)) if (Object.values(x.prijzen || {}).every(p => Date.now() - p.t > BEWAAR)) delete v[sid];
  v[id] = s; await store.setJSON(k, v);
  return json({ ok: true });
};

export const config = { path: '/api/melding', method: ['GET', 'POST'] };
