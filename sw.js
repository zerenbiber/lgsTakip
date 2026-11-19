/* LGS Takip service worker.
   NOT: Her sürümde CACHE adını (lgs-takip-vN) artır; böylece eski önbellek silinir ve güncelleme gelir. */
const CACHE = 'lgs-takip-v17';
const CHART = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'icon.svg'];
const SHELL_URLS = new Set(SHELL.map(p => new URL(p, self.location).href));
const PAGE_URLS = new Set([new URL('./', self.location).href, new URL('index.html', self.location).href]);
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(SHELL);
    try { await c.add(new Request(CHART, { mode: 'cors' })); } catch (err) { /* çevrimdışıysa sonra denenir */ }
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  } catch (err) {
    return (await caches.match(req, { ignoreSearch: true })) || (await caches.match('index.html')) || Response.error();
  }
}
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
  return res;
}
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname === 'api.anthropic.com' || url.hostname === 'api.github.com' || req.cache === 'no-store') return; // ağdan
  const bare = url.origin + url.pathname;
  if (req.mode === 'navigate' || PAGE_URLS.has(bare)) { if (url.origin === self.location.origin) e.respondWith(networkFirst(req)); return; }
  if (SHELL_URLS.has(bare) || req.url === CHART) e.respondWith(cacheFirst(req));
  // diğer istekler (veri URL'leri vb.) doğrudan ağa gider
});
