import { runtime } from '../runtime.js';
import { isRotationPlayBlocked, isMobilePhoneLike } from '../platform/device.js';
import { requestFullscreenOnFirstTouch } from '../platform/fullscreen.js';
import { finishCrashSequence } from '../crash/crash-sequence.js';
import { activateMenuSelection } from '../menu-controls.js';
import { togglePause } from '../pause.js';
import { requestPointerLock, isPointerLocked, updateMenuUi } from '../ui/overlay.js';
import { onResize } from './resize.js';
import { isGameplayActive, isMenuOpen } from '../game-state.js';
export function onGlobalPointerDown(e) {
    if (runtime.sfx) runtime.sfx.unlock();
    if (isRotationPlayBlocked()) return;
    requestFullscreenOnFirstTouch(e);
    if (e.button === 1 && isGameplayActive()) {
        if (e.cancelable) e.preventDefault();
        togglePause();
        return;
    }
    if (runtime.crashAnimating && (e.button === 0 || e.button === 2)) {
        if (e.button === 2 && e.cancelable) e.preventDefault();
        finishCrashSequence();
        return;
    }
    if (!isMobilePhoneLike()) requestPointerLock();
    if (!isMenuOpen()) return;
    if (!isMobilePhoneLike() && !isPointerLocked()) return;
    if (e.button !== 0 && e.button !== 2) return;
    if (e.button === 2 && e.cancelable) e.preventDefault();
    updateMenuUi();
    activateMenuSelection(e.button);
}

export function onGlobalTouchStart(e) {
    if (isRotationPlayBlocked()) return;
    requestFullscreenOnFirstTouch(e);
}

export function onGlobalPointerLockChange() {
    updateMenuUi();
    if (!isMobilePhoneLike() && !isPointerLocked() && !runtime.gamePaused && !isRotationPlayBlocked()) {
        requestPointerLock();
    }
}

export function onGlobalFullscreenChange() {
    onResize();
}
