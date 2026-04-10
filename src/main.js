import { init } from './game/init.js';
import { clearServiceWorkerCacheAndReload } from './sw-reset.js';

window.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey && event.key === 'F6')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void clearServiceWorkerCacheAndReload();
}, true);

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => { });
    });
}

init();
