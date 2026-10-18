// Service worker: app werkt offline (laatst bekende prijzen), live gegevens altijd via het netwerk.
const VERSION = "tankwijzer-v18";
const SHELL = ["./", "index.html", "app.js", "geo.js", "data.json", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Live prijzen, CBS en kaarttegels: nooit uit de cache
  if (url.origin !== location.origin && !/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(url.hostname)) return;
  // Eigen bestanden: netwerk eerst (altijd de nieuwste versie), cache als terugval
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
    return;
  }
  // Lettertypen en Leaflet: cache eerst
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })));
});

// Prijsalarm: pushmelding tonen, en bij tikken de app openen.
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { tekst: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titel || "Tankwijzer", { body: d.tekst || "", icon: "icon-192.png", badge: "icon-192.png", tag: "tw-alarm", renotify: true, data: { url: d.url || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((l) => { for (const c of l) if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); } return self.clients.openWindow(url); }));
});
