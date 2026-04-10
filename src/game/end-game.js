import { MENU_SCREEN_MAIN, menuActions } from './menu/constants.js';
import { HEAD_END_BONUS } from './config/gameplay.js';
import { runtime } from './runtime.js';
import { startDeathReplay } from './replay/replay-bindings.js';
import {
    showEndScoreUi,
    updateMenuUi,
    updatePointerHint,
    updateTimeChillUi,
    getHeadMultiplier,
    setMenuScreen,
    setStatusText
} from './ui/overlay.js';

export function endGame(message, options = {}) {
    const restartCooldownMs = Math.max(0, options.restartCooldownMs || 0);
    runtime.gameActive = false;
    runtime.gamePaused = false;
    setMenuScreen(MENU_SCREEN_MAIN);
    runtime.restartCooldownUntilMs = restartCooldownMs > 0 ? (performance.now() + restartCooldownMs) : 0;
    runtime.restartCooldownLastShownSec = -1;
    runtime.menuIndex = menuActions.indexOf('restart');
    runtime.inputController.reset();
    updateTimeChillUi(false);
    updatePointerHint();
    const heads = getHeadMultiplier();
    const headBonus = heads * HEAD_END_BONUS;
    const finalScore = runtime.score + headBonus;
    showEndScoreUi(finalScore, heads, headBonus, runtime.score);
    setStatusText(message);
    startDeathReplay();
    updateMenuUi();
}
