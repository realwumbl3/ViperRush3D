import * as THREE from 'three';
import { SNAKE_SURFACE_Y, DIR_FORWARD, DIR_WORLD_UP } from '../config/entities.js';
import { WORLD_SIZE } from '../config/world.js';
import {
    MENU_DEMO_SPEED,
    MENU_DEMO_BOOST_SPEED,
    MENU_DEMO_BOOST_DOT,
    MENU_DEMO_TURN_SPEED,
    MENU_DEMO_INITIAL_SEGMENTS,
    MENU_DEMO_MAX_SEGMENTS,
    MENU_DEMO_WALL_MARGIN,
    MENU_DEMO_BODY_AVOID_RADIUS
} from '../config/menu.js';
import { normalizeAngleRad } from '../utils/math.js';
import {
    EAT_DISTANCE_SQ,
    SELF_COLLISION_START_INDEX,
    SELF_COLLISION_DISTANCE_SQ
} from '../config/gameplay.js';
import { runtime } from '../runtime.js';
import { foodEatBurstPos } from '../scratch.js';
import {
    resetPositionHistory,
    appendHeadHistoryPoint,
    setSnakePoseForTrail,
    clearSnakeSegments,
    trimHistoryTail,
    placeBodySegmentAlongTrail,
    addSegment
} from './snake-body.js';
import { spawnFood } from './spawn-food.js';
import { spawnFoodBurst } from '../vfx/burst-api.js';

export function resetMenuDemoSnake() {
    if (!runtime.snakeHead) return;
    runtime.snakeHead.visible = true;
    runtime.snakeHead.position.set(0, SNAKE_SURFACE_Y, 0);
    runtime.currentRotationY = Math.random() * Math.PI * 2;
    clearSnakeSegments();
    resetPositionHistory();
    for (let i = 0; i < MENU_DEMO_INITIAL_SEGMENTS; i++) addSegment();
    setSnakePoseForTrail();
    spawnFood();
}

export function updateMenuDemoAutoplay(delta) {
    if (!runtime.snakeHead || !runtime.food) return;

    const headPos = runtime.snakeHead.position;
    const heading = DIR_FORWARD.clone().applyAxisAngle(DIR_WORLD_UP, runtime.currentRotationY);

    const toFood = runtime.food.position.clone().sub(headPos);
    toFood.y = 0;
    if (toFood.lengthSq() < 1e-8) toFood.copy(heading);
    else toFood.normalize();

    const avoid = new THREE.Vector3();
    const wallBand = MENU_DEMO_WALL_MARGIN;
    const wallScale = 1 / wallBand;
    if (headPos.x > WORLD_SIZE - wallBand) avoid.x -= (headPos.x - (WORLD_SIZE - wallBand)) * wallScale;
    if (headPos.x < -WORLD_SIZE + wallBand) avoid.x += ((-WORLD_SIZE + wallBand) - headPos.x) * wallScale;
    if (headPos.z > WORLD_SIZE - wallBand) avoid.z -= (headPos.z - (WORLD_SIZE - wallBand)) * wallScale;
    if (headPos.z < -WORLD_SIZE + wallBand) avoid.z += ((-WORLD_SIZE + wallBand) - headPos.z) * wallScale;

    const bodyAvoidR = MENU_DEMO_BODY_AVOID_RADIUS;
    const bodyAvoidR2 = bodyAvoidR * bodyAvoidR;
    for (let i = 2; i < runtime.snakeSegments.length; i++) {
        const away = headPos.clone().sub(runtime.snakeSegments[i].position);
        away.y = 0;
        const d2 = away.lengthSq();
        if (d2 < 1e-6 || d2 > bodyAvoidR2) continue;
        const d = Math.sqrt(d2);
        const w = (bodyAvoidR - d) / bodyAvoidR;
        avoid.addScaledVector(away.multiplyScalar(1 / d), w * 1.6);
    }

    const steer = heading.clone().multiplyScalar(0.35)
        .addScaledVector(toFood, 1.15)
        .addScaledVector(avoid, 1.9);
    steer.y = 0;
    if (steer.lengthSq() < 1e-8) steer.copy(heading);
    else steer.normalize();

    const desiredYaw = Math.atan2(-steer.x, -steer.z);
    const dyaw = normalizeAngleRad(desiredYaw - runtime.currentRotationY);
    const maxTurn = MENU_DEMO_TURN_SPEED * delta;
    runtime.currentRotationY += THREE.MathUtils.clamp(dyaw, -maxTurn, maxTurn);

    const moveDir = DIR_FORWARD.clone().applyAxisAngle(DIR_WORLD_UP, runtime.currentRotationY);
    const alignDot = moveDir.dot(toFood);
    const avoidancePressure = avoid.lengthSq();
    const demoSpeed = (alignDot >= MENU_DEMO_BOOST_DOT && avoidancePressure < 0.18)
        ? MENU_DEMO_BOOST_SPEED
        : MENU_DEMO_SPEED;
    runtime.snakeHead.position.addScaledVector(moveDir, demoSpeed * delta);
    runtime.snakeHead.rotation.y = runtime.currentRotationY;

    appendHeadHistoryPoint(runtime.snakeHead.position);
    trimHistoryTail();
    for (let i = 0; i < runtime.snakeSegments.length; i++) placeBodySegmentAlongTrail(i, runtime.snakeSegments[i]);

    if (headPos.distanceToSquared(runtime.food.position) < EAT_DISTANCE_SQ) {
        runtime.food.getWorldPosition(foodEatBurstPos);
        spawnFoodBurst(foodEatBurstPos);
        addSegment();
        if (runtime.snakeSegments.length > MENU_DEMO_MAX_SEGMENTS) {
            const tail = runtime.snakeSegments.pop();
            if (tail) {
                runtime.scene.remove(tail);
                if (tail.geometry) tail.geometry.dispose();
                if (tail.material) tail.material.dispose();
            }
        }
        spawnFood();
    }

    if (Math.abs(headPos.x) > WORLD_SIZE || Math.abs(headPos.z) > WORLD_SIZE) {
        resetMenuDemoSnake();
        return;
    }
    for (let i = SELF_COLLISION_START_INDEX; i < runtime.snakeSegments.length; i++) {
        if (headPos.distanceToSquared(runtime.snakeSegments[i].position) < SELF_COLLISION_DISTANCE_SQ) {
            resetMenuDemoSnake();
            return;
        }
    }
}
