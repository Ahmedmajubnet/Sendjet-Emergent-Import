/* PWA service-worker registration.
 * Registers /service-worker.js after the page is loaded so it never blocks first paint.
 * In dev (npm start) the SW can still be registered — same-origin and identical to prod.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // Wait until the page has finished loading so the SW install can't compete with critical work.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .then((reg) => {
        // Hot-swap on new version (no full page reload needed for the existing tab).
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              // A new version has finished installing. Tell it to take over.
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => {
        // Silent fail: page still works without the SW.
      });
  });
}
