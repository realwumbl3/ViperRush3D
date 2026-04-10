import * as THREE from 'three';
import {
    FOOD_ARROW_COLOR,
    FOOD_ARROW_EMISSIVE_INTENSITY,
    FOOD_ARROW_LINE_THICKNESS,
    FOOD_ARROW_LENGTH,
    FOOD_ARROW_WIDTH,
    FOOD_COLOR,
    FOOD_EMISSIVE_INTENSITY,
    FOOD_ICOSAHEDRON_DETAIL,
    FOOD_ICOSAHEDRON_RADIUS,
    HEAD_COLOR,
    HEAD_EYE_COLOR,
    HEAD_EMISSIVE_INTENSITY,
    FOOD_FLOAT_BASE_Y,
    FOOD_BOB_SPEED,
    FOOD_BOB_AMPLITUDE,
    FOOD_SPIN_Y_SPEED,
    FOOD_SPIN_X_SPEED
} from '../config/entities.js';

export function createFoodMesh() {
    const foodGeo = new THREE.IcosahedronGeometry(FOOD_ICOSAHEDRON_RADIUS, FOOD_ICOSAHEDRON_DETAIL);
    const foodMat = new THREE.MeshStandardMaterial({
        color: FOOD_COLOR,
        emissive: FOOD_COLOR,
        emissiveIntensity: FOOD_EMISSIVE_INTENSITY,
        wireframe: true,
        fog: false
    });
    const foodGlowMat = new THREE.MeshBasicMaterial({
        color: FOOD_COLOR,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
    });
    const foodCore = new THREE.Mesh(foodGeo, foodMat);
    const foodOuter = new THREE.Mesh(foodGeo, foodGlowMat);
    foodOuter.scale.setScalar(1.045);

    const food = new THREE.Group();
    food.add(foodCore);
    food.add(foodOuter);
    return food;
}

export function createFoodArrowMesh() {
    const arrow = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: FOOD_ARROW_COLOR,
        emissive: FOOD_ARROW_COLOR,
        emissiveIntensity: FOOD_ARROW_EMISSIVE_INTENSITY,
        roughness: 0.26,
        metalness: 0.2,
        fog: false,
        depthWrite: false,
        depthTest: false
    });

    const rodGeo = new THREE.CylinderGeometry(
        FOOD_ARROW_LINE_THICKNESS * 0.5,
        FOOD_ARROW_LINE_THICKNESS * 0.5,
        1,
        6,
        1
    );
    const up = new THREE.Vector3(0, 1, 0);
    const tip = new THREE.Vector3(0, 0, 0);
    const baseZ = -FOOD_ARROW_LENGTH;
    const half = FOOD_ARROW_WIDTH;
    const b1 = new THREE.Vector3(-half, -half, baseZ);
    const b2 = new THREE.Vector3(half, -half, baseZ);
    const b3 = new THREE.Vector3(half, half, baseZ);
    const b4 = new THREE.Vector3(-half, half, baseZ);
    const segments = [
        [tip, b1], [tip, b2], [tip, b3], [tip, b4],
        [b1, b2], [b2, b3], [b3, b4], [b4, b1]
    ];

    for (let i = 0; i < segments.length; i++) {
        const a = segments[i][0];
        const b = segments[i][1];
        const dir = b.clone().sub(a);
        const len = dir.length();
        const rod = new THREE.Mesh(rodGeo, mat);
        rod.position.copy(a).addScaledVector(dir, 0.5);
        rod.quaternion.setFromUnitVectors(up, dir.normalize());
        rod.scale.y = len;
        rod.renderOrder = 1000;
        arrow.add(rod);
    }

    arrow.visible = false;
    return arrow;
}

export function createSnakeHeadMesh() {
    const head = new THREE.Group();

    const coreMat = new THREE.MeshStandardMaterial({
        color: HEAD_COLOR,
        emissive: HEAD_COLOR,
        emissiveIntensity: HEAD_EMISSIVE_INTENSITY,
        flatShading: true
    });

    const skull = new THREE.Mesh(new THREE.OctahedronGeometry(0.78, 0), coreMat);
    skull.scale.set(1.0, 0.66, 1.18);
    head.add(skull);

    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 6, 1), coreMat);
    snout.rotation.x = -Math.PI / 2;
    snout.position.set(0, -0.03, -0.92);
    head.add(snout);

    const eyeMat = new THREE.MeshBasicMaterial({ color: HEAD_EYE_COLOR });
    const eyeGeo = new THREE.OctahedronGeometry(0.15, 0);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.23, 0.15, -0.78);
    head.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.23, 0.15, -0.78);
    head.add(rightEye);

    return { head, core: skull };
}

export function updateFoodArrowTransform({
    foodArrow,
    food,
    camera,
    isGameplayActive,
    foodArrowCameraOffset,
    foodArrowWorldPos,
    foodArrowToFood,
    foodArrowForward
}) {
    if (!foodArrow || !food || !camera) return;
    if (!isGameplayActive) {
        foodArrow.visible = false;
        return;
    }

    foodArrowWorldPos.copy(foodArrowCameraOffset).applyQuaternion(camera.quaternion).add(camera.position);
    foodArrow.position.copy(foodArrowWorldPos);

    foodArrowToFood.copy(food.position).sub(foodArrowWorldPos);
    if (foodArrowToFood.lengthSq() < 1e-8) {
        foodArrow.visible = false;
        return;
    }

    foodArrow.quaternion.setFromUnitVectors(foodArrowForward, foodArrowToFood.normalize());
    foodArrow.visible = true;
}

export function updateFoodVisualTransforms(food, elapsedSeconds, delta) {
    if (!food) return;
    food.position.y = FOOD_FLOAT_BASE_Y + Math.sin(elapsedSeconds * FOOD_BOB_SPEED) * FOOD_BOB_AMPLITUDE;
    food.rotation.y += FOOD_SPIN_Y_SPEED * delta;
    food.rotation.x += FOOD_SPIN_X_SPEED * delta;
}
