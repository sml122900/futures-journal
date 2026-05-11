// Futures Journal Service Worker (PWA)
// 인증 페이지·Next.js 내부 리소스는 캐시하지 않고 오프라인 폴백만 제공
const CACHE = "fj-v2";
const PRECACHE = ["/offline.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // 캐시 제외: API, Next.js 내부(HMR·chunks), 인증 관련 경로
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/")) return;
  if (url.pathname.startsWith("/auth/")) return;
  if (e.request.method !== "GET") return;
  // 다른 오리진은 무시
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request).then((res) => {
      // 200 OK만 캐시 (리다이렉트·에러 제외)
      if (res.status === 200 && res.type === "basic") {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return res;
    }).catch(() =>
      caches.match(e.request).then((cached) => cached || caches.match("/offline.html"))
    )
  );
});
