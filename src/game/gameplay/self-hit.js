import {
    DIR_FORWARD,
    DIR_WORLD_UP,
    HEAD_COLOR,
    BODY_COLOR
} from '../config/entities.js';
import {
    SELF_HIT_SEGMENT_LOSS,
    SELF_HIT_IMMUNITY_DURATION,
    SELF_HIT_PULSE_HZ
} from '../config/gameplay.js';
import { HEAD_EMISSIVE_INTENSITY } from '../config/entities.js';
import { runtime } from '../runtime.js';
import { explodeWorldPos, headBaseColor, headBlackColor, headPulseColor } from '../scratch.js';
import { spawnSnakeBurst, queueTailExplosionTrail } from '../vfx/burst-api.js';
import { recordDeathReplayEvent } from '../replay/replay-bindings.js';
import { updateScoreUi } from '../ui/overlay.js';
import { beginSelfCollisionCrash } from '../crash/crash-sequence.js';

export function removeTailSegments(count) {
    const n = Math.max(0, Math.min(count, runtime.snakeSegments.length));
    const removedWorldPositions = [];
    for (let i = 0; i < n; i++) {
        const seg = runtime.snakeSegments.pop();
        if (!seg) continue;
        seg.getWorldPosition(explodeWorldPos);
        removedWorldPositions.push(explodeWorldPos.clone());
        runtime.scene.remove(seg);
        if (seg.geometry) seg.geometry.dispose();
        if (seg.material) seg.material.dispose();
    }
    if (removedWorldPositions.length > 0) {
        recordDeathReplayEvent('tailTrail', {
            color: BODY_COLOR,
            points: removedWorldPositions.map((p) => ({ x: p.x, y: p.y, z: p.z }))
        });
    }
    queueTailExplosionTrail(removedWorldPositions, BODY_COLOR);
    updateScoreUi();
}

export function beginSelfCollisionHit() {
    if (!runtime.gameActive || runtime.selfHitImmunityRemaining > 0) return;
    if (runtime.sfx) {
        if (typeof runtime.sfx.selfHit === 'function') runtime.sfx.selfHit();
        else runtime.sfx.hit();
    }
    runtime.snakeHead.getWorldPosition(explodeWorldPos);
    spawnSnakeBurst(explodeWorldPos, 0x111111);
    spawnSnakeBurst(explodeWorldPos, 0x39ff14);
    recordDeathReplayEvent('hitBurst', { x: explodeWorldPos.x, y: explodeWorldPos.y, z: explodeWorldPos.z });
    removeTailSegments(SELF_HIT_SEGMENT_LOSS);
    if (runtime.snakeSegments.length <= 0) {
        beginSelfCollisionCrash();
        return;
    }
    runtime.selfHitImmunityRemaining = SELF_HIT_IMMUNITY_DURATION;
    runtime.selfHitPulseTime = 0;
}

export function updateSelfHitPulse(delta) {
    const headMat = runtime.snakeHeadCore?.material;
    if (!headMat) return;
    if (runtime.selfHitImmunityRemaining > 0) {
        runtime.selfHitImmunityRemaining = Math.max(0, runtime.selfHitImmunityRemaining - delta);
        runtime.selfHitPulseTime += delta;
        const s = 0.5 + 0.5 * Math.sin(runtime.selfHitPulseTime * SELF_HIT_PULSE_HZ * Math.PI * 2);
        const mul = 0.3 + 0.7 * (1 - s);
        headPulseColor.copy(headBaseColor).lerp(headBlackColor, s);
        headMat.color.copy(headPulseColor);
        headMat.emissive.copy(headPulseColor);
        headMat.emissiveIntensity = HEAD_EMISSIVE_INTENSITY * mul;
    } else {
        headMat.color.copy(headBaseColor);
        headMat.emissive.copy(headBaseColor);
        headMat.emissiveIntensity = HEAD_EMISSIVE_INTENSITY;
    }
}
