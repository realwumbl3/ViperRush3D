export async function clearServiceWorkerCacheAndReload() {
    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map((registration) => registration.unregister()));
        }

        if ('caches' in window) {
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
        }
    } catch {
        // Always attempt to reload even if cache cleanup partially fails.
    }

    const url = new URL(window.location.href);
    url.searchParams.set('_swreset', String(Date.now()));
    window.location.replace(url.toString());
}
