import { MENU_SCREEN_MAIN, menuActions } from './menu/constants.js';
import { runtime } from './runtime.js';
import { isGameplayActive } from './game-state.js';
import {
    hideEndScoreUi,
    updateMenuUi,
    updatePointerHint,
    requestPointerLock,
    setMenuScreen,
    setStatusText
} from './ui/overlay.js';
import { isMobilePhoneLike } from './platform/device.js';
import { isRotationPlayBlocked } from './platform/device.js';

export function pauseGame() {
    if (!isGameplayActive()) return;
    runtime.gamePaused = true;
    runtime.inputController.reset();
    setMenuScreen(MENU_SCREEN_MAIN);
    runtime.menuIndex = menuActions.indexOf('pause');
    setStatusText('PAUSED');
    hideEndScoreUi();
    updatePointerHint();
    updateMenuUi();
}

export function resumeGame() {
    if (isRotationPlayBlocked()) return;
    if (!runtime.gamePaused || !runtime.gameActive) return;
    runtime.gamePaused = false;
    setStatusText('VIPER RUSH');
    if (!isMobilePhoneLike()) requestPointerLock();
    updatePointerHint();
    updateMenuUi();
}

export function togglePause() {
    if (runtime.gamePaused) {
        resumeGame();
    } else if (isGameplayActive()) {
        pauseGame();
    }
}
