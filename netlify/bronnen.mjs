// Bronnen voor de dagprijzen van Tankwijzer. Elke parser krijgt de HTML van de bronpagina en geeft getallen terug,
// of null als de pagina niet meer klopt (dan blijven de vorige waarden staan).
export const BRONNEN = {
  nl: 'https://www.unitedconsumers.com/tanken/brandstofprijzen',
  beMax: 'https://carbu.com/belgie/maximumprijs',
  beProv: 'https://carbu.com/belgie//bestPrice/Belgie/BE/0',
  beAvg: 'https://www.fuel-prices.eu/Belgium/nl',
  deAvg: 'https://www.fuel-prices.eu/Germany/nl',
};
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const getal = s => { const v = parseFloat(String(s).replace(/\./g, '').replace(',', '.')); return v >= 0.5 && v <= 4 ? Math.round(v * 1000) / 1000 : null; };
const tekst = h => String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&euro;/g, '€').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ');
const dmy = (d, m, y) => `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;

// UnitedConsumers: landelijke adviesprijzen (GLA) van vandaag.
export function nlAdvies(h) {
  const t = tekst(h);
  const p = n => { const m = t.match(new RegExp(`${n} GLA \\* € ([\\d,]+)`)); return m ? getal(m[1]) : null; };
  const d = t.match(/Datum overzicht (\d{1,2}) ([a-z]+) (\d{4})/i);
  const r = { e10: p('Euro95'), diesel: p('Diesel'), e5: p('Super'), lpg: p('LPG') };
  if (!r.e10 || !r.diesel || !d || !MAANDEN.includes(d[2].toLowerCase())) return null;
  return { ...r, date: dmy(d[1], MAANDEN.indexOf(d[2].toLowerCase()) + 1, d[3]) };
}

// carbu.com: Belgische maximumprijs vandaag en (als bekend) morgen.
export function beMax(h) {
  const t = tekst(h);
  const kop = t.match(/Vandaag (\d{2})\/(\d{2})\/(\d{2}) (\d{2})\/(\d{2})\/(\d{2})/);
  if (!kop) return null;
  const vandaag = dmy(kop[1], kop[2], '20' + kop[3]), morgen = dmy(kop[4], kop[5], '20' + kop[6]);
  const i = t.indexOf(kop[0]), stuk = t.slice(i, i + 2500);
  const rij = label => {
    const m = stuk.match(new RegExp(label.replace(/[()]/g, '\\$&') + '\\s+([\\d,]+) €/l\\s+(=|([\\d,]+) €/l)'));
    return m ? [getal(m[1]), m[2] === '=' ? getal(m[1]) : getal(m[3])] : [null, null];
  };
  const e10 = rij('Super 95 (E10)'), e5 = rij('Super 98 (E5)'), di = rij('Diesel (B7)'), lpg = rij('LPG');
  if (!e10[0] || !di[0]) return null;
  return { max: { e10: e10[0], e5: e5[0], diesel: di[0], lpg: lpg[0], date: vandaag }, next: { e10: e10[1], e5: e5[1], diesel: di[1], lpg: lpg[1], date: morgen } };
}

// carbu.com: laagste prijs per provincie. Kolommen: E10, 95 E5, 98 E5, 98 E10, Diesel B7, B10, XTL, LPG, ...
export function beProv(h) {
  const t = tekst(h);
  const PROV = ['Antwerpen', 'Vlaams-Brabant', 'Waals Brabant', 'Brussel', 'West-Vlaanderen', 'Oost-Vlaanderen', 'Henegouwen', 'Luik', 'Limburg', 'Luxemburg', 'Namen'];
  const uit = {};
  for (const p of PROV) {
    const m = t.match(new RegExp(`${p} ((?:(?:€ [\\d,]+|-) ){8})`));
    if (!m) continue;
    const k = m[1].trim().split(/ (?=€|-)/).map(x => x === '-' ? null : getal(x.replace('€ ', '')));
    uit[p] = { e10: k[0], e5: k[2], diesel: k[4], lpg: k[7] };
  }
  return Object.keys(uit).length >= 4 ? uit : null;
}

// fuel-prices.eu: wekelijks gemiddelde pompprijs (EU Weekly Oil Bulletin), per land.
// Nieuwe opmaak (okt 2026): tegels "<brandstof> … › € 1,989/l", datum in JSON-LD dateModified.
// De oude opmaak ("Oliebulletin, 19 okt 2026): diesel €x/L, benzine 95 €y/L") blijft als terugval.
export function euBulletin(h) {
  const s = String(h), t = tekst(h);
  const oud = s.match(/Oliebulletin, (\d{1,2}) ([a-z]{3}) (\d{4})\): diesel €([\d,]+)\/L, benzine 95 €([\d,]+)\/L/);
  if (oud && KORT.includes(oud[2])) return { e10: getal(oud[5]), diesel: getal(oud[4]), date: dmy(oud[1], KORT.indexOf(oud[2]) + 1, oud[3]) };
  const dt = t.match(new RegExp(`(?:maandag|[Bb]ulletin van|week van) (\\d{1,2}) (${MAANDEN.join('|')}) (\\d{4})`));
  const dm = dt ? [null, dt[3], String(MAANDEN.indexOf(dt[2]) + 1).padStart(2, '0'), dt[1].padStart(2, '0')] : s.match(/"dateModified":"(\d{4})-(\d{2})-(\d{2})"/);
  if (!dm) return null;
  const tegel = re => { const m = t.match(new RegExp(re + '[^€›]{0,100}› € ([\\d,]+)/l')); return m ? getal(m[1]) : null; };
  const r = { e10: tegel('Benzine 95 E10'), e5: tegel('Super E5'), diesel: tegel('Diesel'), lpg: tegel('LPG'), date: dm[1] + dm[2] + dm[3] };
  return r.diesel && (r.e10 || r.e5) ? r : null;
}
export function beAvg(h) { const r = euBulletin(h); return r && r.e10 && r.diesel ? { e10: r.e10, diesel: r.diesel, lpg: r.lpg ?? null, date: r.date } : null; }
export function deAvg(h) { const r = euBulletin(h); return r && r.diesel && r.e5 ? { e5: r.e5, diesel: r.diesel, lpg: r.lpg ?? null, date: r.date } : null; }

// Duitse grensstrook: punten net over de grens; per punt de stations binnen 5 km via Tankerkönig.
export const GRENS_DE = [
  ['Kleve', 51.79, 6.14], ['Emmerich', 51.83, 6.25], ['Bocholt', 51.84, 6.61], ['Gronau', 52.21, 7.02], ['Bad Bentheim', 52.30, 7.16],
  ['Nordhorn', 52.43, 7.07], ['Bunde', 53.18, 7.27], ['Kaldenkirchen', 51.32, 6.20], ['Aken', 50.78, 6.08], ['Selfkant', 51.00, 5.93],
];
