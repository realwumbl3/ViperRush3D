import * as THREE from 'three';
import { FOG_NEAR, FOG_FAR } from '../config/world.js';
import {
    CRASH_ANIM_DURATION,
    CRASH_PARTICLE_COUNT,
    SNAKE_EXPLODE_STAGGER,
    SNAKE_EXPLODE_HEAD_DELAY
} from '../config/crash.js';
import { smoothstep01 } from '../utils/math.js';
import { applyParticleGroundBounce } from '../vfx/helpers.js';
import { HEAD_COLOR, BODY_COLOR } from '../config/entities.js';
import { runtime } from '../runtime.js';
import { explodeWorldPos } from '../scratch.js';
import { spawnSnakeBurst } from '../vfx/burst-api.js';
import { endGame } from '../end-game.js';

function computeCrashCameraEnd() {
    const head = runtime.snakeHead.position;
    let maxDSq = 0;
    for (let i = 0; i < runtime.snakeSegments.length; i++) {
        const dSq = head.distanceToSquared(runtime.snakeSegments[i].position);
        if (dSq > maxDSq) maxDSq = dSq;
    }
    const dist = Math.max(22, Math.sqrt(maxDSq) * 2.4 + 14);
    return head.clone().add(new THREE.Vector3(dist * 0.22, dist * 0.42, dist * 0.52));
}

export function disposeCrashVfx() {
    while (runtime.crashSnakeBursts.length) {
        const b = runtime.crashSnakeBursts.pop();
        runtime.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
    }
    if (!runtime.crashVfxRoot) {
        runtime.crashParticleMesh = null;
        runtime.crashParticleVel = null;
        runtime.crashGroundCrackGroup = null;
        runtime.crashVerticalCrackGroup = null;
        runtime.crashCrackTipMesh = null;
        return;
    }
    runtime.scene.remove(runtime.crashVfxRoot);
    runtime.crashVfxRoot.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
    });
    const ud = runtime.crashVfxRoot.userData;
    if (ud.fatLineMaterials) ud.fatLineMaterials.forEach(m => m.dispose());
    if (ud.pointMaterial) ud.pointMaterial.dispose();
    runtime.crashVfxRoot = null;
    runtime.crashParticleMesh = null;
    runtime.crashParticleVel = null;
    runtime.crashGroundCrackGroup = null;
    runtime.crashVerticalCrackGroup = null;
    runtime.crashCrackTipMesh = null;
}

function spawnSelfCollisionCrashVfx() {
    disposeCrashVfx();
}

export function updateCrashAnimation(delta) {
    runtime.crashAnimTime += delta;

    const totalPieces = 1 + runtime.snakeSegments.length;
    while (runtime.crashExplodePieceIndex < totalPieces) {
        const tNeed = SNAKE_EXPLODE_HEAD_DELAY + runtime.crashExplodePieceIndex * SNAKE_EXPLODE_STAGGER;
        if (runtime.crashAnimTime < tNeed) break;
        if (runtime.crashExplodePieceIndex === 0) {
            runtime.snakeHead.getWorldPosition(explodeWorldPos);
            runtime.snakeHead.visible = false;
            spawnSnakeBurst(explodeWorldPos, HEAD_COLOR);
        } else {
            const seg = runtime.snakeSegments[runtime.crashExplodePieceIndex - 1];
            seg.getWorldPosition(explodeWorldPos);
            seg.visible = false;
            spawnSnakeBurst(explodeWorldPos, BODY_COLOR);
        }
        runtime.crashExplodePieceIndex++;
    }

    if (runtime.crashParticleMesh && runtime.crashParticleVel) {
        const pos = runtime.crashParticleMesh.geometry.attributes.position.array;
        const n = CRASH_PARTICLE_COUNT;
        for (let i = 0; i < n; i++) {
            const ix = i * 3;
            pos[ix] += runtime.crashParticleVel[ix] * delta;
            pos[ix + 1] += runtime.crashParticleVel[ix + 1] * delta;
            pos[ix + 2] += runtime.crashParticleVel[ix + 2] * delta;
            runtime.crashParticleVel[ix + 1] -= 22 * delta;
            runtime.crashParticleVel[ix] *= 0.992;
            runtime.crashParticleVel[ix + 2] *= 0.992;
        }
        if (runtime.crashVfxRoot) {
            applyParticleGroundBounce(pos, runtime.crashParticleVel, n, runtime.crashVfxRoot.position.y);
        }
        runtime.crashParticleMesh.geometry.attributes.position.needsUpdate = true;
    }

    const u = smoothstep01(runtime.crashAnimTime / runtime.crashTimelineDuration);
    runtime.camera.position.lerpVectors(runtime.crashCamStart, runtime.crashCamEnd, u);
    runtime.camera.lookAt(runtime.snakeHead.position);

    if (runtime.crashAnimTime >= runtime.crashTimelineDuration) {
        finishCrashSequence();
    }
}

export function finishCrashSequence() {
    runtime.crashAnimating = false;
    disposeCrashVfx();
    runtime.scene.fog.near = FOG_NEAR;
    runtime.scene.fog.far = FOG_FAR;
    endGame('CRASHED!');
}

function beginCrashSequence() {
    runtime.gameActive = false;
    if (runtime.sfx && typeof runtime.sfx.death === 'function') runtime.sfx.death();
    runtime.inputController.reset();
    if (typeof beginCrashSequence._onPointerHint === 'function') beginCrashSequence._onPointerHint();

    runtime.crashAnimTime = 0;
    runtime.crashExplodePieceIndex = 0;
    const n = runtime.snakeSegments.length;
    runtime.crashTimelineDuration = Math.max(
        CRASH_ANIM_DURATION,
        SNAKE_EXPLODE_HEAD_DELAY + (1 + n) * SNAKE_EXPLODE_STAGGER + 1.85
    );
    runtime.crashAnimating = true;
    runtime.crashCamStart.copy(runtime.camera.position);
    runtime.crashCamEnd.copy(computeCrashCameraEnd());
    spawnSelfCollisionCrashVfx();

    runtime.scene.fog.near = 6;
    runtime.scene.fog.far = 240;
}

export function beginSelfCollisionCrash() {
    beginCrashSequence();
}

export function setBeginCrashSequencePointerHint(fn) {
    beginCrashSequence._onPointerHint = fn;
}
