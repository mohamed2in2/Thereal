// Minimal service worker — satisfies the PWA installability requirement.
// No offline caching (content is dynamic/auth-gated), just the shell.
self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",    () => {/* pass-through — no caching */});
