# Tankwijzer

Gratis web-app die benzine- en dieselprijzen in Nederland, België en Duitsland vergelijkt: https://goedkopertanken.netlify.app

Geen reclame, geen account, geen cookies, geen verdienmodel.

## Hoe het werkt
- **site/**: de app (index.html, app.js, geo.js, sw.js) en de stijl van de tankgids.
- **scripts/bouw.py**: bouwt `public/`: kopieert de app en maakt de tankgids (prijzen vandaag, 18 grensplaatsen, artikelen), sitemap en robots.txt. Netlify draait dit bij elke push naar `main`.
- **netlify/functions/tk.mjs**: `/api/tk/list.php|prices.php|detail.php` stuurt door naar Tankerkönig met de geheime sleutel `TANKERKOENIG_KEY` (Netlify-omgevingsvariabele, alleen functions). 5 minuten CDN-cache.
- **netlify/functions/prijzen-ophalen.mjs**: elk half uur dagprijzen ophalen (UnitedConsumers, carbu.com, fuel-prices.eu, Tankerkönig voor de Duitse grensstrook) naar Netlify Blobs.
- **netlify/functions/data.mjs**: `/data.json`, de actuele dagprijzen voor app en gids.
- **.github/workflows/prijzen.yml**: twee keer per dag `/data.json` in `site/data-basis.json` zetten, zodat Netlify de gidspagina's opnieuw bouwt.
- Bezoekersstatistiek: GoatCounter (goedkopertanken.goatcounter.com), zonder cookies.

De oude site tankgoedkoper.netlify.app bouwt uit dezelfde repo en stuurt alles door (zie het begin van bouw.py).
