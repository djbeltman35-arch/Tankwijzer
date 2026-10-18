// De actuele dagprijzen voor de app en de gidspagina's: uit Netlify Blobs, anders het basisbestand uit de site.
import { getStore } from '@netlify/blobs';
import basis from '../../site/data-basis.json' with { type: 'json' };

export default async () => {
  const d = (await getStore('prijzen').get('data', { type: 'json' }).catch(() => null)) || basis;
  return Response.json(d, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=0, must-revalidate', 'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=300, stale-while-revalidate=600' } });
};

export const config = { path: '/data.json' };
