import * as THREE from 'three';
import {
    GAMEPLAY_REFERENCE_FPS,
    GAMEPLAY_SPEED_SCALE,
    FORWARD_STEP,
    EAT_DISTANCE_SQ,
    SCORE_PER_FOOD,
    SELF_COLLISION_START_INDEX,
    SELF_COLLISION_DISTANCE_SQ,
    DEATH_REPLAY_CAPTURE_FPS,
    GAME_END_RESTART_COOLDOWN_MS,
    SPEED_BOOST_STEP,
    SPEED_BOOST_MAX,
    SPEED_BRAKE_STEP,
    SPEED_MIN,
    SPEED_RECOVER_STEP,
    SPEED_BASE,
    TIMECHILL_DRAIN_PER_SEC,
    TIMECHILL_RECHARGE_PER_SEC,
    TIMECHILL_MAX,
    TURN_SPEED,
    CONTROLLER_TURN_SHARPNESS,
    CONTROLLER_TURN_SPEED_RADIUS_FACTOR,
    CONTROLLER_TURN_RADIUS_SPEED_INFLUENCE
} from '../config/gameplay.js';
import {
    CAMERA_FOV_BOOST,
    CAMERA_FOV_BOOST_LERP,
    CAMERA_FOV,
    BOOST_MOTION_BLUR_MAX,
    BOOST_MOTION_BLUR_LERP
} from '../config/world.js';
import {
    CAMERA_OFFSET_X,
    CAMERA_OFFSET_Y,
    CAMERA_OFFSET_Z,
    CAMERA_FOLLOW_LERP,
    MENU_IDLE_ORBIT_RADIUS,
    MENU_IDLE_ORBIT_HEIGHT,
    MENU_IDLE_ORBIT_SPEED
} from '../config/menu.js';
import { DIR_FORWARD, DIR_WORLD_UP, SNAKE_SURFACE_Y } from '../config/entities.js';
import { runtime } from '../runtime.js';
import { isGameplayActive, shouldOrbitMenuCamera, isMenuOpen } from '../game-state.js';
import { updateDeathReplay } from '../replay/replay-bindings.js';
import { updateMenuDemoAutoplay } from '../gameplay/menu-demo.js';
import { updateSelfHitPulse, beginSelfCollisionHit } from '../gameplay/self-hit.js';
import { handleWallBounceHit } from '../gameplay/wall-bounce.js';
import {
    appendHeadHistoryPoint,
    trimHistoryTail,
    placeBodySegmentAlongTrail,
    addSegment
} from '../gameplay/snake-body.js';
import { spawnFood } from '../gameplay/spawn-food.js';
import {
    getHeadMultiplier,
    updateScoreUi,
    updateTimerUi,
    updateTimeChillUi,
    updateMenuUi,
    getRestartCooldownRemainingMs
} from '../ui/overlay.js';
import { spawnFoodBurst, updateTailExplosionTrail, updateSnakeBursts } from '../vfx/burst-api.js';
import { recordDeathReplayEvent, captureDeathReplayFrame } from '../replay/replay-bindings.js';
import { endGame } from '../end-game.js';
import { updateCrashAnimation } from '../crash/crash-sequence.js';
import { updateFloorParallax } from '../render/floor-parallax.js';
import { updateFoodArrow, updateFoodVisuals } from '../render/food-view.js';
import { updateMenu3dAnimation } from '../render/menu-3d.js';
import { updateUi3dAnimation } from '../render/ui-3d.js';
import { foodEatBurstPos } from '../scratch.js';
import { enforceRotationPlayGate } from '../platform/rotation-gate.js';

export function animate() {
    requestAnimationFrame(animate);
    const delta = runtime.clock.getDelta();
    const gameplayStep = delta * GAMEPLAY_REFERENCE_FPS * GAMEPLAY_SPEED_SCALE;
    let boostingNow = false;
    runtime.inputController.updateGamepadInput();
    enforceRotationPlayGate();
    if (runtime.sfx && typeof runtime.sfx.setBgmMode === 'function') {
        const bgmMode = isGameplayActive() ? 'game' : (isMenuOpen() ? 'menu' : 'off');
        runtime.sfx.setBgmMode(bgmMode);
    }

    if (isGameplayActive()) {
        runtime.gameTimeRemaining = Math.max(0, runtime.gameTimeRemaining - delta);
        updateTimerUi();
        if (runtime.gameTimeRemaining <= 0) {
            if (runtime.sfx) runtime.sfx.crash();
            endGame('TIME UP!', { restartCooldownMs: GAME_END_RESTART_COOLDOWN_MS });
        }
    }

    if (isGameplayActive()) {
        updateSelfHitPulse(delta);
        const wantsAccel = runtime.input.mouseAccel || runtime.input.gamepadAccel;
        const wantsBrake = runtime.input.mouseBrake || runtime.input.gamepadBrake;
        const usingTimeChill = !wantsAccel && wantsBrake && runtime.timeChillEnergy > 0;
        boostingNow = wantsAccel;
        if (runtime.sfx && typeof runtime.sfx.setBoostActive === 'function') runtime.sfx.setBoostActive(wantsAccel);

        if (wantsAccel) {
            runtime.speedMultiplier = Math.min(runtime.speedMultiplier + (SPEED_BOOST_STEP * gameplayStep), SPEED_BOOST_MAX);
        } else if (usingTimeChill) {
            runtime.speedMultiplier = Math.max(runtime.speedMultiplier - (SPEED_BRAKE_STEP * gameplayStep), SPEED_MIN);
        } else {
            if (runtime.speedMultiplier > SPEED_BASE) {
                runtime.speedMultiplier = Math.max(runtime.speedMultiplier - (SPEED_BOOST_STEP * gameplayStep), SPEED_BASE);
            } else if (runtime.speedMultiplier < SPEED_BASE) {
                runtime.speedMultiplier = Math.min(runtime.speedMultiplier + (SPEED_RECOVER_STEP * gameplayStep), SPEED_BASE);
            }
        }

        if (usingTimeChill) {
            runtime.timeChillEnergy = Math.max(0, runtime.timeChillEnergy - TIMECHILL_DRAIN_PER_SEC * delta);
        } else if (!wantsBrake && runtime.timeChillEnergy < TIMECHILL_MAX) {
            runtime.timeChillEnergy = Math.min(TIMECHILL_MAX, runtime.timeChillEnergy + TIMECHILL_RECHARGE_PER_SEC * delta);
        }
        updateTimeChillUi(usingTimeChill || runtime.timeChillEnergy < TIMECHILL_MAX);
        if (runtime.sfx && typeof runtime.sfx.setTimeChillActive === 'function') runtime.sfx.setTimeChillActive(usingTimeChill);

        const controllerTurnInput = runtime.input.gamepadTurnAxis * CONTROLLER_TURN_SHARPNESS;
        const touchTurnInput = runtime.input.touchTurnAxis || 0;
        const digitalTurnInput = (runtime.input.left ? 1 : 0) - (runtime.input.right ? 1 : 0);
        if (controllerTurnInput !== 0) {
            const controllerFullSpeedScale = runtime.speedMultiplier * CONTROLLER_TURN_SPEED_RADIUS_FACTOR;
            const controllerSpeedTurnScale =
                1 + (controllerFullSpeedScale - 1) * CONTROLLER_TURN_RADIUS_SPEED_INFLUENCE;
            runtime.currentRotationY += TURN_SPEED * controllerSpeedTurnScale * controllerTurnInput * gameplayStep;
        }
        const touchAndDigitalTurnInput = touchTurnInput + digitalTurnInput;
        if (touchAndDigitalTurnInput !== 0) {
            runtime.currentRotationY += TURN_SPEED * touchAndDigitalTurnInput * gameplayStep;
        }

        const direction = DIR_FORWARD.clone().applyAxisAngle(DIR_WORLD_UP, runtime.currentRotationY);

        runtime.snakeHead.position.addScaledVector(direction, FORWARD_STEP * runtime.speedMultiplier * gameplayStep);
        runtime.snakeHead.rotation.y = runtime.currentRotationY;
        handleWallBounceHit();

        appendHeadHistoryPoint(runtime.snakeHead.position);
        trimHistoryTail();

        for (let i = 0; i < runtime.snakeSegments.length; i++) {
            placeBodySegmentAlongTrail(i, runtime.snakeSegments[i]);
        }

        if (runtime.snakeHead.position.distanceToSquared(runtime.food.position) < EAT_DISTANCE_SQ) {
            runtime.score += SCORE_PER_FOOD * getHeadMultiplier();
            runtime.gameTimeRemaining += 1;
            runtime.food.getWorldPosition(foodEatBurstPos);
            spawnFoodBurst(foodEatBurstPos);
            recordDeathReplayEvent('foodBurst', { x: foodEatBurstPos.x, y: foodEatBurstPos.y, z: foodEatBurstPos.z });
            spawnFood();
            addSegment();
            if (runtime.sfx) runtime.sfx.eat();
            updateScoreUi();
            updateTimerUi();
        }

        if (runtime.selfHitImmunityRemaining <= 0) {
            for (let i = SELF_COLLISION_START_INDEX; i < runtime.snakeSegments.length; i++) {
                if (runtime.snakeHead.position.distanceToSquared(runtime.snakeSegments[i].position) < SELF_COLLISION_DISTANCE_SQ) {
                    beginSelfCollisionHit();
                    break;
                }
            }
        }
        if (isGameplayActive()) {
            const camOffset = new THREE.Vector3(CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z)
                .applyAxisAngle(DIR_WORLD_UP, runtime.currentRotationY);
            camOffset.add(runtime.snakeHead.position);
            runtime.camera.position.lerp(camOffset, CAMERA_FOLLOW_LERP);
            runtime.camera.lookAt(runtime.snakeHead.position);
        }

        const replayStep = 1 / DEATH_REPLAY_CAPTURE_FPS;
        runtime.deathReplay.captureAccumulator += delta;
        while (runtime.deathReplay.captureAccumulator >= replayStep) {
            runtime.deathReplay.captureAccumulator -= replayStep;
            captureDeathReplayFrame();
        }
    } else {
        updateSelfHitPulse(delta);
        updateTimeChillUi(false);
        if (runtime.sfx && typeof runtime.sfx.setBoostActive === 'function') runtime.sfx.setBoostActive(false);
        if (runtime.sfx && typeof runtime.sfx.setTimeChillActive === 'function') runtime.sfx.setTimeChillActive(false);
        if (!runtime.crashAnimating && !runtime.gameActive) {
            updateDeathReplay(delta);
        }
        if (shouldOrbitMenuCamera()) {
            updateMenuDemoAutoplay(delta);
            const t = runtime.clock.elapsedTime * MENU_IDLE_ORBIT_SPEED;
            const target = runtime.snakeHead?.position ?? new THREE.Vector3(0, SNAKE_SURFACE_Y, 0);
            runtime.camera.position.set(
                target.x + Math.cos(t) * MENU_IDLE_ORBIT_RADIUS,
                target.y + MENU_IDLE_ORBIT_HEIGHT,
                target.z + Math.sin(t) * MENU_IDLE_ORBIT_RADIUS
            );
            runtime.camera.lookAt(target);
        }
        if (!runtime.crashAnimating) {
            const cooldownMs = getRestartCooldownRemainingMs();
            const secondsLeft = cooldownMs > 0 ? Math.ceil(cooldownMs / 1000) : 0;
            if (secondsLeft !== runtime.restartCooldownLastShownSec) {
                runtime.restartCooldownLastShownSec = secondsLeft;
                updateMenuUi();
            }
        }
    }
    updateFloorParallax(delta);

    if (runtime.crashAnimating) {
        updateCrashAnimation(delta);
    }
    updateTailExplosionTrail(delta);
    updateSnakeBursts(delta);

    const targetFov = runtime.gameActive && boostingNow ? CAMERA_FOV_BOOST : CAMERA_FOV;
    runtime.camera.fov += (targetFov - runtime.camera.fov) * Math.min(1, delta * CAMERA_FOV_BOOST_LERP);
    runtime.camera.updateProjectionMatrix();

    let targetMb = 0;
    if (runtime.gameActive && boostingNow) {
        const sp = Math.max(0, runtime.speedMultiplier - SPEED_BASE);
        const spNorm = Math.min(1, sp / (SPEED_BOOST_MAX - SPEED_BASE + 1e-6));
        targetMb = BOOST_MOTION_BLUR_MAX * (0.72 + 0.28 * spNorm);
    }
    runtime.boostMotionBlurAmt += (targetMb - runtime.boostMotionBlurAmt) * Math.min(1, delta * BOOST_MOTION_BLUR_LERP);
    if (runtime.motionBlurPass) runtime.motionBlurPass.uniforms.strength.value = runtime.boostMotionBlurAmt;

    updateFoodArrow();
    updateFoodVisuals(runtime.clock.elapsedTime, delta);
    updateMenu3dAnimation(runtime.clock.elapsedTime, delta);
    updateUi3dAnimation(runtime.clock.elapsedTime, delta);
    runtime.composer.render();
}
