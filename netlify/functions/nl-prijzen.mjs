// Pompprijzen per tankstation in Nederland en België via de officiële Google Places API (veld fuelOptions).
// Sleutel: Netlify-omgevingsvariabele GOOGLE_PLACES_KEY. Om binnen het gratis deel van Google te blijven:
// - per gebied van 0,1 graad (± 10 km) hoogstens één opvraag per 12 uur (bewaard in Netlify Blobs);
// - hoogstens 30 opvragen per dag en 900 per maand (Google geeft 1.000 per maand gratis). Daarboven alleen bewaarde prijzen.
import { getStore } from '@netlify/blobs';

const SOORT = { E10: 'e10', REGULAR_UNLEADED: 'e10', SP95_E10: 'e10', SP95: 'e10', MIDGRADE: 'e10', DIESEL: 'diesel', TRUCK_DIESEL: null, PREMIUM: 'e5', SP98: 'e5', E5: 'e5', SUPER_PREMIUM: 'e5', LPG: 'lpg' };
const TTL = 12 * 3600e3, PER_DAG = 30, PER_MAAND = 900;
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'public, max-age=0', 'Netlify-CDN-Cache-Control': 'public, s-maxage=600', 'Netlify-Vary': 'query=lat|lng' } });

export function omzetten(places) {
  return (places || []).map(p => {
    const prijzen = {};
    for (const f of p.fuelOptions?.fuelPrices || []) {
      const k = SOORT[f.type]; if (!k || !f.price) continue;
      const v = Math.round((+(f.price.units || 0) + (f.price.nanos || 0) / 1e9) * 1000) / 1000;
      if (v > 0.4 && v < 4 && (!prijzen[k] || f.type === 'E10')) prijzen[k] = { p: v, t: Date.parse(f.updateTime) || Date.now() };
    }
    return { id: 'g' + p.id, naam: p.displayName?.text || 'Tankstation', adres: p.shortFormattedAddress || p.formattedAddress || '', lat: p.location?.latitude, lng: p.location?.longitude, prijzen };
  }).filter(s => s.lat && Object.keys(s.prijzen).length);
}

export default async req => {
  const key = Netlify.env.get('GOOGLE_PLACES_KEY');
  if (!key) return json({ ok: false, stations: [], reden: 'niet ingesteld' });
  const u = new URL(req.url), lat = Math.round(+u.searchParams.get('lat') * 10) / 10, lng = Math.round(+u.searchParams.get('lng') * 10) / 10;
  if (!(lat > 49.4 && lat < 53.7 && lng > 2.5 && lng < 7.3)) return json({ ok: false, stations: [], reden: 'buiten NL/BE' });
  const store = getStore('google-prijzen'), vak = `v${lat}_${lng}`;
  const bewaard = await store.get(vak, { type: 'json' }).catch(() => null);
  if (bewaard && Date.now() - bewaard.t < TTL) return json({ ok: true, stations: bewaard.stations, bron: 'bewaard' });
  const dag = new Date().toISOString().slice(0, 10), maand = dag.slice(0, 7);
  const teller = (await store.get('teller', { type: 'json' }).catch(() => null)) || {};
  const nDag = teller[dag] || 0, nMaand = teller[maand] || 0;
  if (nDag >= PER_DAG || nMaand >= PER_MAAND) return json({ ok: true, stations: bewaard?.stations || [], bron: 'limiet' });
  await store.setJSON('teller', { [dag]: nDag + 1, [maand]: nMaand + 1 });
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.shortFormattedAddress,places.fuelOptions' },
      body: JSON.stringify({ includedTypes: ['gas_station'], maxResultCount: 20, rankPreference: 'DISTANCE', languageCode: 'nl', locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 7000 } } }),
      signal: AbortSignal.timeout(12000),
    });
    const j = await r.json();
    if (!r.ok) { console.log('google fout', r.status, JSON.stringify(j).slice(0, 300)); return json({ ok: false, stations: bewaard?.stations || [], reden: 'google ' + r.status }); }
    const stations = omzetten(j.places);
    await store.setJSON(vak, { t: Date.now(), stations });
    return json({ ok: true, stations, bron: 'google' });
  } catch (e) { return json({ ok: false, stations: bewaard?.stations || [], reden: e.message }); }
};

export const config = { path: '/api/nl-prijzen' };
