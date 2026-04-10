import {
    MENU_SCREEN_MAIN,
    MENU_SCREEN_SETTINGS,
    MENU_SCREEN_EXTRAS,
    MENU_SCREEN_ASSET_VIEWER,
    menuActions
} from '../menu/constants.js';
import { formatGameTime } from '../time/format.js';
import {
    MOUSE_SENSITIVITY_MIN,
    MOUSE_SENSITIVITY_MAX,
    TIMECHILL_MAX,
    HEAD_END_BONUS
} from '../config/gameplay.js';
import {
    STORAGE_KEY_MOUSE_SENS,
    STORAGE_KEY_HIGH_SCORE,
    STORAGE_KEY_SHOW_FPS
} from '../config/menu.js';
import {
    getSavedHighScore as getSavedHighScoreFromStorage,
    saveHighScoreIfNeeded as saveHighScoreIfNeededInStorage
} from '../utils/high-score-storage.js';
import { runtime } from '../runtime.js';
import { isRotationPlayBlocked } from '../platform/device.js';
import { isMobilePhoneLike } from '../platform/device.js';
import { isMenuOpen } from '../game-state.js';
import { updateMenu3dState } from '../render/menu-3d.js';
import { setUi3dState } from '../render/ui-3d.js';
import { setAssetViewer3dState } from '../render/asset-viewer-3d.js';

let menuStatusText = 'VIPER RUSH';
let endUiVisible = false;
let endScoreText = '';
let endBreakdownText = '';
let endHighText = '';
let pointerHintVisible = false;
let timeChillBarVisible = false;

function mouseSensitivityToPercent(value) {
    const denom = MOUSE_SENSITIVITY_MAX - MOUSE_SENSITIVITY_MIN;
    if (denom <= 0) return 0;
    const t = (value - MOUSE_SENSITIVITY_MIN) / denom;
    return Math.round(Math.max(0, Math.min(1, t)) * 100);
}

function syncUi3d() {
    const menuVisible = isMenuOpen();
    const showEndScreenDetails = runtime.menuScreen === MENU_SCREEN_MAIN;
    setAssetViewer3dState({
        isVisible: menuVisible && runtime.menuScreen === MENU_SCREEN_ASSET_VIEWER
    });
    setUi3dState({
        hudVisible: runtime.gameActive && !runtime.gamePaused,
        scoreText: `${runtime.score}`,
        multiplierText: `x${getHeadMultiplier()}`,
        timerText: formatGameTime(runtime.gameTimeRemaining),
        timeChillVisible: timeChillBarVisible,
        timeChillFraction: Math.max(0, Math.min(TIMECHILL_MAX, runtime.timeChillEnergy)) / TIMECHILL_MAX,
        pointerHintVisible,
        pointerHintText: 'CLICK TO LOCK POINTER',
        fpsVisible: runtime.showFpsCounter,
        fpsText: runtime.fpsDisplayText,
        menuVisible,
        endVisible: endUiVisible && showEndScreenDetails,
        endScoreText,
        endBreakdownText,
        endHighText
    });
}

export function getRestartCooldownRemainingMs() {
    if (runtime.gameActive || runtime.crashAnimating) return 0;
    return Math.max(0, runtime.restartCooldownUntilMs - performance.now());
}

export function isRestartOnCooldown() {
    return getRestartCooldownRemainingMs() > 0;
}

export function getDefaultMainMenuAction() {
    return runtime.gameActive ? 'pause' : 'restart';
}

export function setMenuScreen(screen) {
    runtime.menuScreen = screen;
}

export function setStatusText(text) {
    menuStatusText = String(text || '');
    syncUi3d();
}

export function getVisibleMenuActions() {
    if (runtime.menuScreen === MENU_SCREEN_SETTINGS) return ['sfx', 'sensitivity', 'fpsCounter', 'clearCache', 'back'];
    if (runtime.menuScreen === MENU_SCREEN_EXTRAS) return ['assetViewer', 'backExtras'];
    if (runtime.menuScreen === MENU_SCREEN_ASSET_VIEWER) return ['backAssetViewer'];
    return runtime.gameActive ? ['pause', 'restart', 'settings', 'extras'] : ['restart', 'settings', 'extras'];
}

export function normalizeMenuIndex() {
    const visible = getVisibleMenuActions();
    const currentAction = menuActions[runtime.menuIndex];
    if (visible.indexOf(currentAction) >= 0) return;
    let fallbackAction = getDefaultMainMenuAction();
    if (runtime.menuScreen === MENU_SCREEN_SETTINGS) fallbackAction = 'sfx';
    if (runtime.menuScreen === MENU_SCREEN_EXTRAS) fallbackAction = 'assetViewer';
    if (runtime.menuScreen === MENU_SCREEN_ASSET_VIEWER) fallbackAction = 'backAssetViewer';
    runtime.menuIndex = menuActions.indexOf(fallbackAction);
}

export function isPointerLocked() {
    return document.pointerLockElement === runtime.renderer.domElement;
}

export function requestPointerLock() {
    if (!runtime.renderer?.domElement?.requestPointerLock) return;
    if (isRotationPlayBlocked()) return;
    try {
        runtime.renderer.domElement.requestPointerLock();
    } catch (_) {
        // Browser may reject lock without a fresh user gesture.
    }
}

export function updatePointerHint() {
    pointerHintVisible = runtime.gameActive && !isPointerLocked() && !isRotationPlayBlocked() && !isMobilePhoneLike();
    syncUi3d();
}

export function updateTimeChillUi(showBar) {
    timeChillBarVisible = !!showBar;
    syncUi3d();
}

export function getHeadMultiplier() {
    return Math.max(1, runtime.snakeSegments.length);
}

export function updateScoreUi() {
    syncUi3d();
}

export function updateTimerUi() {
    syncUi3d();
}

export function updateFpsUi(value) {
    const next = `${Math.max(0, Math.round(value || 0))}`;
    if (runtime.fpsDisplayText === next) return;
    runtime.fpsDisplayText = next;
    syncUi3d();
}

export function updateTouchControlsUi() {
    // Touch controls are now screen-based gesture zones with no DOM UI.
}

export function updateMenuUi() {
    normalizeMenuIndex();
    const visible = getVisibleMenuActions();
    const pauseLabel = runtime.gamePaused ? 'Resume' : 'Pause';
    const settingsLabel = 'Settings';
    const extrasLabel = 'Extras';
    const assetViewerLabel = '3D Asset Viewer';
    const sfxLabel = `SFX: ${runtime.sfx && runtime.sfx.isEnabled() ? 'ON' : 'OFF'}`;
    const sensitivityLabel = `Mouse Sensitivity: ${mouseSensitivityToPercent(runtime.mouseSensitivityX)}`;
    const fpsCounterLabel = `FPS Counter: ${runtime.showFpsCounter ? 'ON' : 'OFF'}`;
    const clearCacheLabel = 'Clear Cache + Reload';
    const backLabel = 'Back';
    let restartLabel = 'Start Run';
    if (runtime.gameActive) {
        restartLabel = 'Restart Run';
    } else {
        const cooldownMs = getRestartCooldownRemainingMs();
        if (cooldownMs > 0) {
            const secondsLeft = Math.ceil(cooldownMs / 1000);
            restartLabel = `Start Run (${secondsLeft})`;
        }
    }

    const menuItems = [];
    for (let i = 0; i < visible.length; i++) {
        const action = visible[i];
        let label = action;
        if (action === 'pause') label = pauseLabel;
        if (action === 'restart') label = restartLabel;
        if (action === 'settings') label = settingsLabel;
        if (action === 'extras') label = extrasLabel;
        if (action === 'assetViewer') label = assetViewerLabel;
        if (action === 'sfx') label = sfxLabel;
        if (action === 'sensitivity') label = sensitivityLabel;
        if (action === 'fpsCounter') label = fpsCounterLabel;
        if (action === 'clearCache') label = clearCacheLabel;
        if (action === 'back') label = backLabel;
        if (action === 'backExtras') label = backLabel;
        if (action === 'backAssetViewer') label = backLabel;
        menuItems.push({ action, label });
    }
    let titleText = menuStatusText;
    if (runtime.menuScreen === MENU_SCREEN_SETTINGS) titleText = '';
    if (runtime.menuScreen === MENU_SCREEN_EXTRAS) titleText = 'EXTRAS';
    if (runtime.menuScreen === MENU_SCREEN_ASSET_VIEWER) titleText = '';
    const isEndMainScreen = runtime.menuScreen === MENU_SCREEN_MAIN && endUiVisible;
    updateMenu3dState({
        items: menuItems,
        activeAction: menuActions[runtime.menuIndex],
        showHighlight: true,
        isVisible: isMenuOpen() && runtime.menuScreen !== MENU_SCREEN_ASSET_VIEWER,
        titleText,
        endScreenLayout: isEndMainScreen
    });
    syncUi3d();
}

export function getSavedHighScore() {
    return getSavedHighScoreFromStorage(STORAGE_KEY_HIGH_SCORE);
}

export function saveHighScoreIfNeeded(value) {
    return saveHighScoreIfNeededInStorage(STORAGE_KEY_HIGH_SCORE, value);
}

export function hideEndScoreUi() {
    endUiVisible = false;
    syncUi3d();
}

export function showEndScoreUi(finalScore, heads, headBonus, baseScore) {
    const highScore = saveHighScoreIfNeeded(finalScore);
    endUiVisible = true;
    endScoreText = `${finalScore}`;
    endBreakdownText = `BASE ${baseScore} + HEADS ${heads} x ${HEAD_END_BONUS} = +${headBonus}`;
    endHighText = `HIGH SCORE: ${highScore}`;
    syncUi3d();
}

export function initMouseSensitivitySettings() {
    const saved = localStorage.getItem(STORAGE_KEY_MOUSE_SENS);
    if (saved != null) {
        const v = parseFloat(saved);
        if (!Number.isNaN(v)) {
            runtime.mouseSensitivityX = Math.max(MOUSE_SENSITIVITY_MIN, Math.min(MOUSE_SENSITIVITY_MAX, v));
        }
    }
}

export function initFpsCounterSettings() {
    const saved = localStorage.getItem(STORAGE_KEY_SHOW_FPS);
    runtime.showFpsCounter = saved === '1';
}
