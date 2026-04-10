import { runtime } from '../runtime.js';
import { isMobilePhoneLike } from './device.js';

function isTouchActivationEvent(e) {
    if (!e) return false;
    if (e.type === 'touchstart') return true;
    return typeof e.pointerType === 'string' && e.pointerType.toLowerCase() === 'touch';
}

export function requestFullscreenOnFirstTouch(e) {
    if (runtime.fullscreenRequestedOnce) return;
    if (runtime.fullscreenAttemptInFlight) return;
    if (!isMobilePhoneLike()) return;
    if (!isTouchActivationEvent(e)) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        runtime.fullscreenRequestedOnce = true;
        return;
    }
    const targets = [
        document.documentElement,
        document.body,
        runtime.renderer?.domElement ?? null
    ].filter(Boolean);

    const onRequested = result => {
        if (result && typeof result.then === 'function') {
            runtime.fullscreenAttemptInFlight = true;
            result.then(() => {
                runtime.fullscreenAttemptInFlight = false;
                if (document.fullscreenElement || document.webkitFullscreenElement) {
                    runtime.fullscreenRequestedOnce = true;
                }
            }).catch(() => {
                runtime.fullscreenAttemptInFlight = false;
            });
        } else if (document.fullscreenElement || document.webkitFullscreenElement) {
            runtime.fullscreenRequestedOnce = true;
        }
    };

    for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        try {
            if (t.requestFullscreen) {
                onRequested(t.requestFullscreen());
                break;
            }
            if (t.webkitRequestFullscreen) {
                onRequested(t.webkitRequestFullscreen());
                break;
            }
        } catch (_) {
            // Keep trying fallback targets.
        }
    }
}
