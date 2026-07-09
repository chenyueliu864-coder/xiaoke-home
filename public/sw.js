// ============================================================
// ⚠️ 重要：每次前端改动发布前，必须把下面的 CACHE_NAME 版本号 +1
//    （v2 → v3 → v4 …），否则手机 PWA 旧缓存不更新，看不到新 UI！
// ============================================================
const CACHE_NAME = 'xiaoke-v6';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});
