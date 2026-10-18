// Prijsalarm aan- en afmelden. Geen namen of e-mailadressen; locatie alleen grof (1 decimaal, ± 10 km).
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const PUSHDIENSTEN = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|mozilla\.com|mozaws\.net|push\.apple\.com|notify\.windows\.com)\//;
const sleutel = e => crypto.createHash('sha256').update(e).digest('hex').slice(0, 40);
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export default async req => {
  if (req.method === 'GET') return json({ sleutel: Netlify.env.get('VAPID_PUBLIC') || null });
  let body; try { body = await req.json(); } catch { return json({ fout: 'ongeldig verzoek' }, 400); }
  const sub = body?.sub;
  if (!sub?.endpoint || !PUSHDIENSTEN.test(sub.endpoint)) return json({ fout: 'onbekende pushdienst' }, 400);
  const store = getStore('alarm'), k = sleutel(sub.endpoint);
  if (req.method === 'DELETE') { await store.delete(k); return json({ ok: true }); }
  if (!sub.keys?.p256dh || !sub.keys?.auth) return json({ fout: 'sleutels ontbreken' }, 400);
  const alarmen = {};
  for (const f of ['e10', 'diesel', 'e5', 'lpg']) { const v = +body.alarmen?.[f]; if (v > 0.5 && v < 4) alarmen[f] = Math.round(v * 1000) / 1000; }
  if (!Object.keys(alarmen).length) { await store.delete(k); return json({ ok: true, alarmen: 0 }); }
  const t = body.thuis; const thuis = t && isFinite(t[0]) && isFinite(t[1]) && Math.abs(t[0] - 51.5) < 4 && Math.abs(t[1] - 5.5) < 6 ? [Math.round(t[0] * 10) / 10, Math.round(t[1] * 10) / 10] : null;
  const oud = await store.get(k, { type: 'json' }).catch(() => null);
  await store.setJSON(k, { sub: { endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } }, alarmen, thuis, gemeld: oud?.gemeld || {}, sinds: oud?.sinds || new Date().toISOString() });
  return json({ ok: true, alarmen: Object.keys(alarmen).length });
};

export const config = { path: '/api/alarm', method: ['GET', 'POST', 'DELETE'] };
