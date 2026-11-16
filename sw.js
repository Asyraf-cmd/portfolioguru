/* e-Portfolio Profesionalisme Guru — service worker
   Tukar CACHE_NAME setiap kali anda menukar fail ini atau senarai fail di bawah. */
const CACHE_NAME = "eportfolio-guru-pwa-v4";
const CORE = ["./", "./index.html", "./manifest.webmanifest"];
const OPTIONAL = ["./guru-192.png", "./guru-512.png", "./guru-maskable-512.png"];
const NAV_TIMEOUT = 4000; // ms: jika rangkaian lambat, guna salinan cache

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    // cache:"reload" memastikan salinan terkini diambil dari pelayan, bukan cache HTTP pelayar
    await cache.addAll(CORE.map(url => new Request(url, { cache: "reload" })));
    // Ikon yang tiada tidak akan menggagalkan pemasangan
    await Promise.allSettled(OPTIONAL.map(url => cache.add(new Request(url, { cache: "reload" }))));
  }));
  // Tiada skipWaiting() automatik: halaman akan bertanya kepada pengguna dahulu.
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function putInCache(req, res) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(req, res);
}

// Halaman: rangkaian dahulu (supaya versi baharu sentiasa sampai), cache jika luar talian atau lambat
function handleNavigate(event) {
  const req = event.request;
  const network = fetch(req, { cache: "no-cache" }).then(async res => {
    if (res && res.ok) await putInCache(req, res.clone());
    return res;
  });
  event.waitUntil(network.catch(() => {}));
  return (async () => {
    try {
      const res = await Promise.race([network, new Promise(r => setTimeout(r, NAV_TIMEOUT))]);
      if (res) return res;
    } catch (e) { /* luar talian */ }
    const cached = (await caches.match(req, { ignoreSearch: true })) || (await caches.match("./index.html"));
    return cached || network;
  })();
}

// Fail statik (ikon, manifest): cache dahulu, kemudian rangkaian
async function handleStatic(event) {
  const req = event.request;
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok && res.type === "basic") event.waitUntil(putInCache(req, res.clone()));
  return res;
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") event.respondWith(handleNavigate(event));
  else event.respondWith(handleStatic(event));
});
