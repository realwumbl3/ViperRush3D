import { runtime } from '../runtime.js';

export function spawnSnakeBurst(worldPos, colorHex) {
    if (!runtime.burstSystem) return;
    runtime.burstSystem.spawnSnakeBurst(worldPos, colorHex);
}

export function spawnFoodBurst(worldPos) {
    if (!runtime.burstSystem) return;
    runtime.burstSystem.spawnFoodBurst(worldPos);
}

export function queueTailExplosionTrail(worldPositions, colorHex) {
    if (!runtime.burstSystem) return;
    runtime.burstSystem.queueTailExplosionTrail(worldPositions, colorHex);
}

export function updateTailExplosionTrail(delta) {
    if (!runtime.burstSystem) return;
    runtime.burstSystem.updateTailExplosionTrail(delta);
}

export function updateSnakeBursts(delta) {
    if (!runtime.burstSystem) return;
    runtime.burstSystem.updateSnakeBursts(delta);
}
