// De actuele dagprijzen voor de app en de gidspagina's, uit Netlify Blobs.
// Zijn ze ouder dan 40 minuten (bijvoorbeeld omdat de geplande taak niet liep), dan worden ze hier meteen ververst.
import { getStore } from '@netlify/blobs';
import { verzamel } from './prijzen-ophalen.mjs';
import basis from '../../site/data-basis.json' with { type: 'json' };

const OUD = 40 * 60e3;
export default async () => {
  const store = getStore('prijzen');
  let d = await store.get('data', { type: 'json' }).catch(() => null);
  if (!d || !d._ts || Date.now() - d._ts > OUD) {
    const log = [];
    try {
      d = await verzamel(d || basis, Netlify.env.get('TANKERKOENIG_KEY'), m => log.push(m));
      d._ts = Date.now(); d._log = log;
      await store.setJSON('data', d);
    } catch (e) { d = d || basis; d._log = [...log, 'verversen mislukt: ' + e.message]; }
  }
  return Response.json(d, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=300, stale-while-revalidate=600' } });
};

export const config = { path: '/data.json' };
