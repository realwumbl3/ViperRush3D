import {
    MENU_SCREEN_MAIN,
    MENU_SCREEN_SETTINGS,
    MENU_SCREEN_EXTRAS,
    MENU_SCREEN_ASSET_VIEWER,
    menuActions
} from './menu/constants.js';
import {
    MOUSE_SENSITIVITY_MIN,
    MOUSE_SENSITIVITY_MAX,
    MOUSE_SENSITIVITY_STEP
} from './config/gameplay.js';
import { STORAGE_KEY_MOUSE_SENS, STORAGE_KEY_SHOW_FPS, STORAGE_KEY_MUSIC } from './config/menu.js';
import { runtime } from './runtime.js';
import { isGameplayActive, isMenuOpen } from './game-state.js';
import { isRotationPlayBlocked, isMobilePhoneLike } from './platform/device.js';
import {
    updateMenuUi,
    isPointerLocked,
    isRestartOnCooldown,
    getDefaultMainMenuAction,
    setMenuScreen,
    getVisibleMenuActions,
    normalizeMenuIndex
} from './ui/overlay.js';
import { togglePause } from './pause.js';
import { finishCrashSequence } from './crash/crash-sequence.js';
import { startGame } from './start-game.js';
import { clearServiceWorkerCacheAndReload } from '../sw-reset.js';
import { cycleAssetViewerModel } from './render/asset-viewer-3d.js';

function handleRefreshConfirmKey(e) {
    e.preventDefault();
    if (runtime.refreshReloadArmed) {
        runtime.refreshReloadArmed = false;
        window.location.reload();
        return true;
    }

    runtime.refreshReloadArmed = true;
    if (isGameplayActive()) togglePause();
    setMenuScreen(MENU_SCREEN_MAIN);
    runtime.menuIndex = menuActions.indexOf('refreshConfirm');
    updateMenuUi();
    return true;
}

export function moveMenuSelection(dir) {
    if (isRotationPlayBlocked()) return;
    if (!isMenuOpen()) return;
    if (isRestartOnCooldown()) return;
    const visible = getVisibleMenuActions();
    const currentAction = menuActions[runtime.menuIndex];
    let visibleIndex = visible.indexOf(currentAction);
    if (visibleIndex < 0) visibleIndex = 0;
    visibleIndex = (visibleIndex + dir + visible.length) % visible.length;
    runtime.menuIndex = menuActions.indexOf(visible[visibleIndex]);
    updateMenuUi();
    if (runtime.sfx) runtime.sfx.menuMove();
}

export function adjustMouseSensitivity(dir) {
    const clamped = Math.max(
        MOUSE_SENSITIVITY_MIN,
        Math.min(MOUSE_SENSITIVITY_MAX, runtime.mouseSensitivityX + dir * MOUSE_SENSITIVITY_STEP)
    );
    if (Math.abs(clamped - runtime.mouseSensitivityX) < 1e-7) return;
    runtime.mouseSensitivityX = clamped;
    localStorage.setItem(STORAGE_KEY_MOUSE_SENS, String(runtime.mouseSensitivityX));
    updateMenuUi();
}

export function activateMenuSelection(button = 0) {
    if (isRotationPlayBlocked()) return;
    if (!isMenuOpen()) return;
    if (isRestartOnCooldown()) return;
    normalizeMenuIndex();
    const action = menuActions[runtime.menuIndex];
    if (action === 'refreshConfirm') {
        runtime.refreshReloadArmed = false;
        window.location.reload();
    } else if (action === 'refreshBack') {
        runtime.refreshReloadArmed = false;
        runtime.menuIndex = menuActions.indexOf(getDefaultMainMenuAction());
        if (runtime.sfx) runtime.sfx.menuSelect();
        updateMenuUi();
    } else if (action === 'pause') {
        if (!runtime.gameActive) return;
        if (runtime.sfx) runtime.sfx.menuSelect();
        togglePause();
    } else if (action === 'restart') {
        if (isRestartOnCooldown()) return;
        if (runtime.sfx) runtime.sfx.menuSelect();
        startGame();
    } else if (action === 'settings') {
        if (runtime.sfx) runtime.sfx.menuSelect();
        setMenuScreen(MENU_SCREEN_SETTINGS);
        runtime.menuIndex = menuActions.indexOf('sfx');
        updateMenuUi();
    } else if (action === 'extras') {
        if (runtime.sfx) runtime.sfx.menuSelect();
        setMenuScreen(MENU_SCREEN_EXTRAS);
        runtime.menuIndex = menuActions.indexOf('assetViewer');
        updateMenuUi();
    } else if (action === 'assetViewer') {
        if (runtime.sfx) runtime.sfx.menuSelect();
        setMenuScreen(MENU_SCREEN_ASSET_VIEWER);
        runtime.menuIndex = menuActions.indexOf('backAssetViewer');
        updateMenuUi();
    } else if (action === 'sfx') {
        if (runtime.sfx) runtime.sfx.menuSelect();
        runtime.sfx.setEnabled(!runtime.sfx.isEnabled());
        updateMenuUi();
    } else if (action === 'music') {
        if (runtime.sfx) runtime.sfx.menuSelect();
        if (runtime.sfx && typeof runtime.sfx.isMusicEnabled === 'function' && typeof runtime.sfx.setMusicEnabled === 'function') {
            const next = !runtime.sfx.isMusicEnabled();
            runtime.sfx.setMusicEnabled(next);
            localStorage.setItem(STORAGE_KEY_MUSIC, next ? '1' : '0');
        }
        updateMenuUi();
    } else if (action === 'sensitivity') {
        if (runtime.sfx) runtime.sfx.menuSelect();
        adjustMouseSensitivity(button === 2 ? 1 : -1);
    } else if (action === 'fpsCounter') {
        if (runtime.sfx) runtime.sfx.menuSelect();
        runtime.showFpsCounter = !runtime.showFpsCounter;
        localStorage.setItem(STORAGE_KEY_SHOW_FPS, runtime.showFpsCounter ? '1' : '0');
        updateMenuUi();
    } else if (action === 'clearCache') {
        if (runtime.sfx) runtime.sfx.menuSelect();
        void clearServiceWorkerCacheAndReload();
    } else if (action === 'back') {
        if (runtime.sfx) runtime.sfx.menuSelect();
        setMenuScreen(MENU_SCREEN_MAIN);
        runtime.menuIndex = menuActions.indexOf(getDefaultMainMenuAction());
        updateMenuUi();
    } else if (action === 'backExtras') {
        if (runtime.sfx) runtime.sfx.menuSelect();
        setMenuScreen(MENU_SCREEN_MAIN);
        runtime.menuIndex = menuActions.indexOf('extras');
        updateMenuUi();
    } else if (action === 'backAssetViewer') {
        if (runtime.sfx) runtime.sfx.menuSelect();
        setMenuScreen(MENU_SCREEN_EXTRAS);
        runtime.menuIndex = menuActions.indexOf('assetViewer');
        updateMenuUi();
    }
}

export function handleMenuKeyDown(e) {
    if (runtime.sfx) runtime.sfx.unlock();
    if (e.key === 'F5') {
        handleRefreshConfirmKey(e);
        return;
    }
    if (e.key === 'Escape' && isGameplayActive()) {
        e.preventDefault();
        togglePause();
        return;
    }
    if (isRotationPlayBlocked()) {
        const k = e.key;
        if (
            k === ' ' || k === 'Spacebar' || k === 'Enter' || k === 'ArrowUp' || k === 'ArrowDown' ||
            k === 'ArrowLeft' || k === 'ArrowRight' || k === 'w' || k === 'W' || k === 'a' || k === 'A' ||
            k === 's' || k === 'S' || k === 'd' || k === 'D'
        ) {
            e.preventDefault();
        }
        return;
    }
    const k = e.key;
    if ((k === ' ' || k === 'Spacebar') && runtime.crashAnimating) {
        e.preventDefault();
        finishCrashSequence();
        return;
    }
    if ((k === ' ' || k === 'Spacebar') && isGameplayActive()) {
        e.preventDefault();
        togglePause();
        return;
    }
    if (!isMenuOpen()) return;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') {
        e.preventDefault();
        moveMenuSelection(-1);
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        e.preventDefault();
        moveMenuSelection(1);
    } else if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        if (menuActions[runtime.menuIndex] !== 'sensitivity' || runtime.menuScreen !== MENU_SCREEN_SETTINGS) return;
        e.preventDefault();
        if (runtime.sfx) runtime.sfx.menuSelect();
        adjustMouseSensitivity(-1);
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        if (menuActions[runtime.menuIndex] !== 'sensitivity' || runtime.menuScreen !== MENU_SCREEN_SETTINGS) return;
        e.preventDefault();
        if (runtime.sfx) runtime.sfx.menuSelect();
        adjustMouseSensitivity(1);
    } else if (k === 'Enter' || k === ' ') {
        e.preventDefault();
        activateMenuSelection();
    }
}

export function onGlobalWheel(e) {
    if (isRotationPlayBlocked()) return;
    if (isRestartOnCooldown()) return;
    if (!isMenuOpen() || isMobilePhoneLike() || !isPointerLocked()) return;
    if (typeof e.deltaY !== 'number' || e.deltaY === 0) return;
    if (e.cancelable) e.preventDefault();
    if (runtime.menuScreen === MENU_SCREEN_ASSET_VIEWER) {
        cycleAssetViewerModel(e.deltaY > 0 ? 1 : -1);
        return;
    }
    moveMenuSelection(e.deltaY > 0 ? 1 : -1);
}
