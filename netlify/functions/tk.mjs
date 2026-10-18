// Doorgeefluik naar Tankerkönig (live Duitse prijzen per tankstation) voor alle bezoekers.
// De API-sleutel staat alleen hier, als geheime Netlify-instelling (TANKERKOENIG_KEY), nooit in de browser.
// Antwoorden worden 5 minuten op het CDN bewaard, zodat Tankerkönig niet onnodig vaak wordt bevraagd.
const API = 'https://creativecommons.tankerkoenig.de/json/';
const BESTANDEN = { 'list.php': ['lat', 'lng', 'rad', 'sort', 'type'], 'prices.php': ['ids'], 'detail.php': ['id'] };
const json = (data, status, extra = {}) => Response.json(data, { status, headers: { 'Access-Control-Allow-Origin': '*', ...extra } });

export default async (req, context) => {
  const url = new URL(req.url);
  const bestand = context.params?.bestand || url.pathname.split('/').pop();
  const toegestaan = BESTANDEN[bestand];
  if (!toegestaan) return json({ ok: false, message: 'onbekende opvraag' }, 404);
  const key = Netlify.env.get('TANKERKOENIG_KEY');
  if (!key) return json({ ok: false, message: 'Live Duitse prijzen zijn tijdelijk niet beschikbaar.' }, 503);
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
  q.set('apikey', key);
  try {
    const r = await fetch(API + bestand + '?' + q, { headers: { 'User-Agent': 'Tankwijzer (goedkopertanken.netlify.app)' } });
    const j = await r.json();
    return json(j, r.ok ? 200 : 502, j.ok ? { 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=300, stale-while-revalidate=120', 'Netlify-Vary': `query=${toegestaan.join('|')}` } : {});
  } catch (e) {
    return json({ ok: false, message: 'Tankerkönig is even niet bereikbaar.' }, 502);
  }
};

export const config = { path: '/api/tk/:bestand' };
