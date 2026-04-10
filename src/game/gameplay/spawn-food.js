import * as THREE from 'three';
import {
    FOOD_FLOAT_BASE_Y,
    FOOD_SPAWN_RANGE_SCALE,
    MIN_FOOD_DISTANCE_FROM_BODY_SQ,
    MIN_FOOD_DISTANCE_FROM_HEAD_SQ
} from '../config/entities.js';
import { WORLD_SIZE } from '../config/world.js';
import { runtime } from '../runtime.js';
import { foodSpawnCandidate } from '../scratch.js';

export function spawnFood() {
    function isSpawnValid(x, z) {
        foodSpawnCandidate.set(x, FOOD_FLOAT_BASE_Y, z);
        if (runtime.snakeHead && foodSpawnCandidate.distanceToSquared(runtime.snakeHead.position) < MIN_FOOD_DISTANCE_FROM_HEAD_SQ) {
            return false;
        }
        for (let i = 0; i < runtime.snakeSegments.length; i++) {
            if (foodSpawnCandidate.distanceToSquared(runtime.snakeSegments[i].position) < MIN_FOOD_DISTANCE_FROM_BODY_SQ) {
                return false;
            }
        }
        return true;
    }

    const range = WORLD_SIZE * FOOD_SPAWN_RANGE_SCALE;
    for (let i = 0; i < 96; i++) {
        const x = (Math.random() - 0.5) * range;
        const z = (Math.random() - 0.5) * range;
        if (!isSpawnValid(x, z)) continue;
        runtime.food.position.set(x, FOOD_FLOAT_BASE_Y, z);
        return;
    }

    const hx = runtime.snakeHead ? runtime.snakeHead.position.x : 0;
    const hz = runtime.snakeHead ? runtime.snakeHead.position.z : 0;
    const maxR = range * 0.5;
    for (let r = 10; r <= maxR; r += 6) {
        for (let a = 0; a < 16; a++) {
            const t = (a / 16) * Math.PI * 2;
            const x = THREE.MathUtils.clamp(hx + Math.cos(t) * r, -range * 0.5, range * 0.5);
            const z = THREE.MathUtils.clamp(hz + Math.sin(t) * r, -range * 0.5, range * 0.5);
            if (!isSpawnValid(x, z)) continue;
            runtime.food.position.set(x, FOOD_FLOAT_BASE_Y, z);
            return;
        }
    }

    runtime.food.position.set(0, FOOD_FLOAT_BASE_Y, 0);
}
