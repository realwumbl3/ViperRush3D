import * as THREE from 'three';
import { WORLD_SIZE } from '../config/world.js';
import { DIR_FORWARD, DIR_WORLD_UP } from '../config/entities.js';
import { WALL_BOUNCE_INSET, SELF_HIT_SEGMENT_LOSS, SELF_HIT_IMMUNITY_DURATION } from '../config/gameplay.js';
import { runtime } from '../runtime.js';
import { explodeWorldPos } from '../scratch.js';
import { spawnSnakeBurst } from '../vfx/burst-api.js';
import { recordDeathReplayEvent } from '../replay/replay-bindings.js';
import { removeTailSegments } from './self-hit.js';
import { beginSelfCollisionCrash } from '../crash/crash-sequence.js';

export function handleWallBounceHit() {
    const p = runtime.snakeHead.position;
    const hitXPos = p.x > WORLD_SIZE;
    const hitXNeg = p.x < -WORLD_SIZE;
    const hitZPos = p.z > WORLD_SIZE;
    const hitZNeg = p.z < -WORLD_SIZE;
    const hitX = hitXPos || hitXNeg;
    const hitZ = hitZPos || hitZNeg;
    if (!hitX && !hitZ) return false;

    if (hitXPos) p.x = WORLD_SIZE - (p.x - WORLD_SIZE);
    else if (hitXNeg) p.x = -WORLD_SIZE + (-WORLD_SIZE - p.x);
    if (hitZPos) p.z = WORLD_SIZE - (p.z - WORLD_SIZE);
    else if (hitZNeg) p.z = -WORLD_SIZE + (-WORLD_SIZE - p.z);
    p.x = THREE.MathUtils.clamp(p.x, -WORLD_SIZE + WALL_BOUNCE_INSET, WORLD_SIZE - WALL_BOUNCE_INSET);
    p.z = THREE.MathUtils.clamp(p.z, -WORLD_SIZE + WALL_BOUNCE_INSET, WORLD_SIZE - WALL_BOUNCE_INSET);

    const moveDir = DIR_FORWARD.clone().applyAxisAngle(DIR_WORLD_UP, runtime.currentRotationY);
    if (hitXPos) moveDir.reflect(new THREE.Vector3(-1, 0, 0));
    else if (hitXNeg) moveDir.reflect(new THREE.Vector3(1, 0, 0));
    if (hitZPos) moveDir.reflect(new THREE.Vector3(0, 0, -1));
    else if (hitZNeg) moveDir.reflect(new THREE.Vector3(0, 0, 1));
    moveDir.normalize();
    runtime.currentRotationY = Math.atan2(-moveDir.x, -moveDir.z);
    runtime.snakeHead.rotation.y = runtime.currentRotationY;

    if (runtime.selfHitImmunityRemaining <= 0) {
        if (runtime.sfx) {
            if (typeof runtime.sfx.bounce === 'function') runtime.sfx.bounce();
            else if (typeof runtime.sfx.selfHit === 'function') runtime.sfx.selfHit();
            else runtime.sfx.hit();
        }
        runtime.snakeHead.getWorldPosition(explodeWorldPos);
        spawnSnakeBurst(explodeWorldPos, 0x111111);
        spawnSnakeBurst(explodeWorldPos, 0x39ff14);
        recordDeathReplayEvent('hitBurst', { x: explodeWorldPos.x, y: explodeWorldPos.y, z: explodeWorldPos.z });
        removeTailSegments(SELF_HIT_SEGMENT_LOSS);
        if (runtime.snakeSegments.length <= 0) {
            beginSelfCollisionCrash();
            return true;
        }
        runtime.selfHitImmunityRemaining = SELF_HIT_IMMUNITY_DURATION;
        runtime.selfHitPulseTime = 0;
    }

    return true;
}
