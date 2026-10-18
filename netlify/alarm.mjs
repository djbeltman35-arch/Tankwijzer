// Prijsalarm: wie een alarm zet, krijgt een pushmelding zodra aan de grens in de buurt een prijs onder zijn bedrag zakt.
// Bewaard per apparaat (Netlify Blobs, store "alarm"): het push-abonnement, brandstof, bedrag en een grove locatie (1 decimaal).
import { getStore } from '@netlify/blobs';
import { stuur } from './webpush.mjs';
import { GRENS_DE } from './bronnen.mjs';

export const BE_PUNTEN = [['Antwerpen', 51.45, 5.04], ['Antwerpen', 51.47, 4.45], ['Antwerpen', 51.45, 4.74], ['Limburg', 50.89, 5.65], ['Limburg', 51.23, 5.31],
  ['Limburg', 51.25, 5.55], ['Limburg', 51.10, 5.78], ['Luik', 50.74, 5.70], ['Oost-Vlaanderen', 51.20, 3.81]];
const NAAM = { e10: 'Euro95/E10', diesel: 'Diesel', e5: 'Super E5/98', lpg: 'LPG' };
const km = (a, b) => { const r = Math.PI / 180, x = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
const p3 = v => v.toFixed(3).replace('.', ',');

// Goedkoopste plek binnen het bereik van iemands (grove) locatie voor een brandstof.
export function besteInBuurt(d, fuel, thuis, bereik = 60) {
  const kand = [];
  for (const [plaats, lat, lng] of GRENS_DE) { const p = d.de?.points?.[plaats]; if (p?.[fuel]) kand.push({ prijs: p[fuel], waar: `${plaats}${p[fuel + 'Waar'] ? ' (' + p[fuel + 'Waar'] + ')' : ''}`, pos: [lat, lng] }); }
  for (const [prov, lat, lng] of BE_PUNTEN) { const p = d.be?.prov?.[prov]; if (p?.[fuel]) kand.push({ prijs: p[fuel], waar: `België, provincie ${prov}`, pos: [lat, lng] }); }
  const dichtbij = thuis ? kand.filter(k => km(thuis, k.pos) <= bereik) : kand;
  return (dichtbij.length ? dichtbij : kand).sort((a, b) => a.prijs - b.prijs)[0] || null;
}

export async function controleerAlarmen(d, pub, priv, log = console.log) {
  if (!pub || !priv) { log('alarm: VAPID-sleutels ontbreken'); return; }
  const store = getStore('alarm');
  const { blobs } = await store.list();
  let gestuurd = 0;
  for (const { key } of blobs) {
    const a = await store.get(key, { type: 'json' }).catch(() => null);
    if (!a?.sub || !a.alarmen) continue;
    let veranderd = false;
    for (const [fuel, bedrag] of Object.entries(a.alarmen)) {
      const best = besteInBuurt(d, fuel, a.thuis);
      if (!best || best.prijs > bedrag) continue;
      const vorig = a.gemeld?.[fuel];
      // Niet vaker dan eens per 12 uur, tenzij de prijs nog eens flink (1 cent) lager is.
      if (vorig && Date.now() - vorig.t < 12 * 3600e3 && best.prijs > vorig.p - 0.01) continue;
      try {
        const status = await stuur(a.sub, { titel: `🔔 ${NAAM[fuel]} € ${p3(best.prijs)}`, tekst: `Onder je alarm van € ${p3(bedrag)}: ${best.waar}.`, url: '/?bron=alarm' }, pub, priv);
        if (status === 404 || status === 410) { await store.delete(key); veranderd = false; break; }
        if (status < 400) { a.gemeld = { ...(a.gemeld || {}), [fuel]: { t: Date.now(), p: best.prijs } }; veranderd = true; gestuurd++; }
        else log('alarm push status ' + status);
      } catch (e) { log('alarm push fout ' + e.message); }
    }
    if (veranderd) await store.setJSON(key, a);
  }
  log(`alarm: ${gestuurd} meldingen, ${blobs.length} abonnees`);
}
