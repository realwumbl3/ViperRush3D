import { MENU_SCREEN_MAIN, menuActions } from './menu/constants.js';
import { CAMERA_FOV } from './config/world.js';
import { FOG_NEAR, FOG_FAR } from './config/world.js';
import { SNAKE_SURFACE_Y, DIR_FORWARD, DIR_WORLD_UP, INITIAL_BODY_SEGMENTS, BODY_SEGMENT_SPACING } from './config/entities.js';
import {
    SPEED_BASE,
    TIMECHILL_MAX,
    GAME_DURATION_SECONDS
} from './config/gameplay.js';
import { runtime } from './runtime.js';
import { isRotationPlayBlocked } from './platform/device.js';
import { isMobilePhoneLike } from './platform/device.js';
import {
    updateMenuUi,
    updatePointerHint,
    updateTimeChillUi,
    updateTimerUi,
    hideEndScoreUi,
    updateScoreUi,
    updateTouchControlsUi,
    setMenuScreen,
    setStatusText
} from './ui/overlay.js';
import { clearDeathReplay, captureDeathReplayFrame } from './replay/replay-bindings.js';
import {
    resetPositionHistory,
    appendHeadHistoryPoint,
    placeBodySegmentAlongTrail,
    addSegment
} from './gameplay/snake-body.js';
import { spawnFood } from './gameplay/spawn-food.js';
import { disposeCrashVfx } from './crash/crash-sequence.js';
import { requestPointerLock } from './ui/overlay.js';

export function startGame() {
    if (isRotationPlayBlocked()) {
        runtime.inputController.reset();
        updateTouchControlsUi();
        return;
    }
    runtime.restartCooldownUntilMs = 0;
    runtime.restartCooldownLastShownSec = -1;
    clearDeathReplay();
    runtime.tailExplosionQueue.length = 0;
    runtime.hasStartedRunOnce = true;
    setMenuScreen(MENU_SCREEN_MAIN);
    runtime.menuIndex = menuActions.indexOf('restart');
    setStatusText('VIPER RUSH');
    runtime.score = 0;
    updateScoreUi();
    hideEndScoreUi();
    updateMenuUi();
    updateTouchControlsUi();

    runtime.camera.fov = CAMERA_FOV;
    runtime.camera.updateProjectionMatrix();
    runtime.boostMotionBlurAmt = 0;
    if (runtime.motionBlurPass) runtime.motionBlurPass.uniforms.strength.value = 0;

    runtime.snakeHead.position.set(0, SNAKE_SURFACE_Y, 0);
    runtime.snakeHead.visible = true;
    runtime.currentRotationY = 0;
    runtime.speedMultiplier = SPEED_BASE;
    runtime.timeChillEnergy = TIMECHILL_MAX;
    runtime.gameTimeRemaining = GAME_DURATION_SECONDS;
    runtime.selfHitImmunityRemaining = 0;
    runtime.selfHitPulseTime = 0;
    runtime.refreshReloadArmed = false;
    runtime.gameActive = true;
    runtime.gamePaused = false;
    runtime.crashAnimating = false;
    disposeCrashVfx();
    runtime.scene.fog.near = FOG_NEAR;
    runtime.scene.fog.far = FOG_FAR;

    runtime.snakeSegments.forEach(s => runtime.scene.remove(s));
    runtime.snakeSegments = [];
    resetPositionHistory();
    runtime.inputController.reset();

    for (let i = 0; i < INITIAL_BODY_SEGMENTS; i++) {
        addSegment();
    }

    const headFwd = DIR_FORWARD.clone().applyAxisAngle(DIR_WORLD_UP, runtime.currentRotationY);
    for (let i = 0; i < runtime.snakeSegments.length; i++) {
        const offset = (i + 1) * BODY_SEGMENT_SPACING;
        runtime.snakeSegments[i].position.copy(
            runtime.snakeHead.position.clone().addScaledVector(headFwd, -offset)
        );
    }

    appendHeadHistoryPoint(runtime.snakeHead.position);

    for (let i = 0; i < runtime.snakeSegments.length; i++) {
        placeBodySegmentAlongTrail(i, runtime.snakeSegments[i]);
    }
    captureDeathReplayFrame();
    updateScoreUi();

    spawnFood();

    if (!isMobilePhoneLike()) requestPointerLock();
    updatePointerHint();
    updateTimeChillUi(false);
    updateTimerUi();
}
