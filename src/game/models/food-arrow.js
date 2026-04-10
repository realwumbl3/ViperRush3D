import * as THREE from 'three';
import {
    FOOD_ARROW_COLOR,
    FOOD_ARROW_EMISSIVE_INTENSITY,
    FOOD_ARROW_LINE_THICKNESS,
    FOOD_ARROW_LENGTH,
    FOOD_ARROW_WIDTH
} from '../config/entities.js';

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

export function createGameFoodArrowModel() {
    return {
        name: 'FOOD ARROW',
        mesh: createFoodArrowMesh()
    };
}

export function createViewerFoodArrowModel() {
    const mesh = createFoodArrowMesh();
    mesh.visible = true;
    mesh.scale.setScalar(1.66);
    mesh.rotation.y = Math.PI;
    return {
        name: 'FOOD ARROW',
        mesh
    };
}
