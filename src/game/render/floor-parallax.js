import * as THREE from 'three';
import { FLOOR_GRID_EXTENT, GRID_DIVISIONS } from '../config/world.js';
import { FLOOR_PARALLAX_FACTOR, FLOOR_PARALLAX_LERP } from '../config/world.js';
import { runtime } from '../runtime.js';
import { floorParallaxTarget, floorParallaxOffset } from '../scratch.js';

export function updateFloorParallax(delta) {
    if (!runtime.floorGridParallaxGroup || !runtime.camera) return;
    floorParallaxTarget.set(
        -runtime.camera.position.x * FLOOR_PARALLAX_FACTOR,
        0,
        -runtime.camera.position.z * FLOOR_PARALLAX_FACTOR
    );
    floorParallaxOffset.lerp(floorParallaxTarget, Math.min(1, delta * FLOOR_PARALLAX_LERP));

    const step = FLOOR_GRID_EXTENT / GRID_DIVISIONS;
    const maxShift = step * 0.5;
    runtime.floorGridParallaxGroup.position.set(
        THREE.MathUtils.clamp(floorParallaxOffset.x, -maxShift, maxShift),
        0,
        THREE.MathUtils.clamp(floorParallaxOffset.z, -maxShift, maxShift)
    );
}
