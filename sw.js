/* Fabi Platform V2 — Service Worker + OneSignal */
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE = "fabi-platform-v2-20261007";
const SHELL = [
  "/",
  "/index.html",
  "/assets/fabi-v2.css?v=20261007",
  "/assets/fabi-v2.js?v=20261007",
  "/site.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon-32x32.png",
  "/flogo.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function sameOrigin(url){ return url.origin === self.location.origin; }

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (!sameOrigin(url)) return;

  // Never cache API/proxy or account-like routes.
  if (/\/api\/|\/proxy\b/i.test(url.pathname + url.search)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, clone));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/")))
    );
    return;
  }

  const destination = req.destination;
  if (["style","script","image","font"].includes(destination)) {
    event.respondWith(
      caches.match(req).then(cached => {
        const refresh = fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE).then(cache => cache.put(req, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || refresh;
      })
    );
  }
});
