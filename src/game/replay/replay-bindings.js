import * as THREE from 'three';
import { FOOD_FLOAT_BASE_Y } from '../config/entities.js';
import { CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z } from '../config/menu.js';
import { DIR_WORLD_UP } from '../config/entities.js';
import {
    DEATH_REPLAY_CAPTURE_FPS,
    DEATH_REPLAY_SPEED
} from '../config/gameplay.js';
import { CAMERA_FOLLOW_LERP } from '../config/menu.js';
import { BODY_COLOR } from '../config/entities.js';
import { clearDeathReplayState, recordDeathReplayEventState, captureDeathReplayFrameState, startDeathReplayState, updateDeathReplayState } from './death-replay.js';
import { runtime } from '../runtime.js';
import { isGameplayActive } from '../game-state.js';
import { ensureSnakeSegmentCount } from '../gameplay/snake-body.js';
import { spawnFoodBurst, spawnSnakeBurst, queueTailExplosionTrail } from '../vfx/burst-api.js';

export function clearDeathReplay() {
    clearDeathReplayState(runtime.deathReplay);
}

export function recordDeathReplayEvent(type, data = null) {
    if (!isGameplayActive()) return;
    recordDeathReplayEventState(runtime.deathReplay, type, data);
}

export function captureDeathReplayFrame() {
    captureDeathReplayFrameState(runtime.deathReplay, {
        snakeHead: runtime.snakeHead,
        snakeSegments: runtime.snakeSegments,
        currentRotationY: runtime.currentRotationY,
        food: runtime.food,
        foodFloatBaseY: FOOD_FLOAT_BASE_Y
    });
}

function applyDeathReplayFrame(frame) {
    const segCount = frame.segPos.length / 3;
    ensureSnakeSegmentCount(segCount);
    runtime.snakeHead.visible = true;
    runtime.snakeHead.position.set(frame.hx, frame.hy, frame.hz);
    runtime.currentRotationY = frame.ry;
    runtime.snakeHead.rotation.y = runtime.currentRotationY;
    if (runtime.food) {
        runtime.food.visible = true;
        runtime.food.position.set(frame.fx, frame.fy, frame.fz);
    }

    for (let i = 0; i < segCount; i++) {
        const seg = runtime.snakeSegments[i];
        const pIdx = i * 3;
        const qIdx = i * 4;
        seg.visible = true;
        seg.position.set(frame.segPos[pIdx], frame.segPos[pIdx + 1], frame.segPos[pIdx + 2]);
        seg.quaternion.set(frame.segQuat[qIdx], frame.segQuat[qIdx + 1], frame.segQuat[qIdx + 2], frame.segQuat[qIdx + 3]);
    }
}

function playDeathReplayEventsForFrame(frameIndex) {
    const events = runtime.deathReplay.eventsByFrame.get(frameIndex);
    if (!events || events.length === 0) return;
    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.type === 'foodBurst' && ev.data) {
            const p = ev.data;
            spawnFoodBurst(new THREE.Vector3(p.x, p.y, p.z));
        } else if (ev.type === 'hitBurst' && ev.data) {
            const p = ev.data;
            const wp = new THREE.Vector3(p.x, p.y, p.z);
            spawnSnakeBurst(wp, 0x111111);
            spawnSnakeBurst(wp, 0x39ff14);
        } else if (ev.type === 'tailTrail' && ev.data && Array.isArray(ev.data.points)) {
            const pts = ev.data.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
            queueTailExplosionTrail(pts, ev.data.color ?? BODY_COLOR);
        }
    }
}

export function startDeathReplay() {
    startDeathReplayState(runtime.deathReplay, {
        applyFrame: applyDeathReplayFrame,
        playEvents: playDeathReplayEventsForFrame
    });
}

export function updateDeathReplay(delta) {
    updateDeathReplayState(runtime.deathReplay, delta, {
        captureFps: DEATH_REPLAY_CAPTURE_FPS,
        playbackSpeed: DEATH_REPLAY_SPEED,
        applyFrame: applyDeathReplayFrame,
        playEvents: playDeathReplayEventsForFrame
    });
    if (!runtime.deathReplay.active) return;

    const camOffset = new THREE.Vector3(CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z)
        .applyAxisAngle(DIR_WORLD_UP, runtime.currentRotationY);
    camOffset.add(runtime.snakeHead.position);
    runtime.camera.position.lerp(camOffset, Math.min(1, CAMERA_FOLLOW_LERP * 1.25));
    runtime.camera.lookAt(runtime.snakeHead.position);
}
